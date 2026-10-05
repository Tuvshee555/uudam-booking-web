import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { inventorySql, objectsSql, quoteIdentifier, databaseIdentity, readSnapshot } from './audit-database-merge.mjs';

const q = quoteIdentifier;
const qualified = (table) => `${q(table.schema)}.${q(table.name)}`;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const options = (readOnly) => ({ readOnly, isolationLevel: 'RepeatableRead',
  fetchOptions: { signal: AbortSignal.timeout(60_000) } });
const guardName = '__database_consolidation_guard';

// PostgreSQL 18 catalogs NOT NULL separately; the column flag works in both 17 and 18.
export function portableTableSchema(table) {
  const { count, rowsJson, ...schema } = table;
  return { ...schema, constraints: schema.constraints.filter((item) => !item.definition.startsWith('NOT NULL ')) };
}

const enumsSql = `SELECT n.nspname::text AS schema, t.typname::text AS name,
  jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
  WHERE n.nspname='public' GROUP BY n.nspname,t.typname ORDER BY t.typname`;
const indexesSql = `SELECT n.nspname::text AS schema, c.relname::text AS name,
  pg_get_indexdef(c.oid) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='i'
    AND NOT EXISTS (SELECT 1 FROM pg_constraint p WHERE p.conindid=c.oid)
  ORDER BY c.relname`;

export function createSchemaStatements(backup) {
  if (backup.tables.some((table) => table.constraints.some((item) =>
    item.definition.startsWith('NOT NULL ') && !item.validated))) {
    throw new Error('Unvalidated NOT NULL constraints require a separate migration.');
  }
  if (backup.tables.some((table) => table.schema !== 'public' || table.kind !== 'r' || table.row_security)) {
    throw new Error('Only ordinary public tables without row security are supported.');
  }
  if (backup.tables.some((table) => table.columns.some((column) =>
    column.identity || column.generated || column.default?.includes('nextval(')))) {
    throw new Error('Identity, generated and sequence-backed columns require a separate migration.');
  }
  const enums = backup.enums.map((item) => `CREATE TYPE ${qualified(item)} AS ENUM (${item.labels
    .map((label) => `'${label.replaceAll("'", "''")}'`).join(', ')})`);
  const tables = backup.tables.map((table) => `CREATE TABLE ${qualified(table)} (${table.columns
    .map((column) => `${q(column.name)} ${column.type}${column.default === null ? '' : ` DEFAULT ${column.default}`}${column.required ? ' NOT NULL' : ''}`)
    .join(', ')})`);
  const constraints = backup.tables.flatMap((table) => portableTableSchema(table).constraints.map((constraint) => ({
    foreign: constraint.definition.startsWith('FOREIGN KEY'),
    sql: `ALTER TABLE ${qualified(table)} ADD CONSTRAINT ${q(constraint.name)} ${constraint.definition}`,
  }))).sort((a, b) => Number(a.foreign) - Number(b.foreign)).map((item) => item.sql);
  return { enums, tables, constraints, indexes: backup.indexes.map((index) => index.definition) };
}

export function exactComparisonQuery(table) {
  return `WITH expected AS (
    SELECT to_jsonb(t) AS row FROM jsonb_populate_recordset(NULL::${qualified(table)}, $1::jsonb) t
  ), actual AS (SELECT to_jsonb(t) AS row FROM ${qualified(table)} t), differences AS (
    (SELECT row FROM expected EXCEPT ALL SELECT row FROM actual)
    UNION ALL (SELECT row FROM actual EXCEPT ALL SELECT row FROM expected)
  ) SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM differences) THEN 0 ELSE 1 END AS verified`;
}

export async function exportSource(sql) {
  const [discovered] = await sql.transaction([sql(inventorySql)], options(true));
  const [, tables, objects, enums, indexes, ...records] = await sql.transaction([
    sql("SET LOCAL TIME ZONE 'UTC'"), sql(inventorySql), sql(objectsSql), sql(enumsSql), sql(indexesSql),
    ...discovered.map((table) => sql(`SELECT count(*)::text AS count,
      COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb)::text AS rows_json
      FROM ${qualified(table)} t`)),
  ], options(true));
  if (JSON.stringify(tables) !== JSON.stringify(discovered)) throw new Error('Source schema changed during export.');
  const unsupported = objects.filter((object) => !['enum', 'index'].includes(object.kind)
    && !object.name.includes(guardName));
  if (unsupported.length) throw new Error('Source has additional schema objects requiring explicit migration.');
  return { exportedAt: new Date().toISOString(), tables: tables.map((table, i) => ({ ...table,
    count: Number(records[i][0].count), rowsJson: records[i][0].rows_json })), enums, indexes, objects };
}

async function verifyData(sql, backup) {
  await sql.transaction([sql("SET LOCAL TIME ZONE 'UTC'"),
    ...backup.tables.map((table) => sql(exactComparisonQuery(table), [table.rowsJson])),
  ], options(true));
  const snapshot = await readSnapshot(sql);
  for (const table of backup.tables) {
    const actual = snapshot.tables.find((item) => item.schema === table.schema && item.name === table.name);
    if (!actual || JSON.stringify(portableTableSchema(actual)) !== JSON.stringify(portableTableSchema(table))) {
      throw new Error(`Schema differs for ${table.name}.`);
    }
  }
  for (const object of backup.objects.filter((item) => !item.name.includes(guardName))) {
    const actual = snapshot.objects.find((item) => item.schema === object.schema && item.name === object.name && item.kind === object.kind);
    if (JSON.stringify(actual) !== JSON.stringify(object)) throw new Error(`Schema object differs for ${object.name}.`);
  }
  return backup.tables.map((table) => ({ table: table.name, rows: table.count, exactDataMatch: true, schemaMatch: true }));
}

async function applyCopy(sql, backup) {
  const existing = await readSnapshot(sql);
  if (backup.tables.some((table) => existing.tables.some((item) => item.schema === table.schema && item.name === table.name))) {
    throw new Error('A source table already exists in the target. Verify it; this importer never overwrites or deletes.');
  }
  if (backup.enums.some((item) => existing.objects.some((other) => other.schema === item.schema && other.name === item.name))) {
    throw new Error('A source enum already exists in the target.');
  }
  const ddl = createSchemaStatements(backup);
  // All DDL, data, constraints and exact value checks commit together or roll back together.
  const result = await sql.transaction([
    sql("SET LOCAL TIME ZONE 'UTC'"), sql('SET LOCAL search_path TO public'),
    sql('SELECT pg_advisory_xact_lock(734620261004)'),
    ...ddl.enums.map((statement) => sql(statement)),
    ...ddl.tables.map((statement) => sql(statement)),
    ...backup.tables.map((table) => {
      const columns = table.columns.map((column) => q(column.name)).join(', ');
      return sql(`INSERT INTO ${qualified(table)} (${columns})
        SELECT ${columns} FROM jsonb_populate_recordset(NULL::${qualified(table)}, $1::jsonb)`, [table.rowsJson]);
    }),
    ...ddl.constraints.map((statement) => sql(statement)),
    ...ddl.indexes.map((statement) => sql(statement)),
    ...backup.tables.map((table) => sql(exactComparisonQuery(table), [table.rowsJson])),
  ], options(false));
  if (!result.length) throw new Error('No import result was returned. Verify the target before retrying.');
  return verifyData(sql, backup);
}

async function freezeSource(sql) {
  const [tables] = await sql.transaction([sql(inventorySql)], options(true));
  if (tables.some((table) => table.schema !== 'public' || table.kind !== 'r')) throw new Error('Unexpected source tables.');
  await sql.transaction([
    sql("SET LOCAL lock_timeout='10s'"),
    sql(`LOCK TABLE ${tables.map(qualified).join(', ')} IN SHARE ROW EXCLUSIVE MODE`),
    sql(`CREATE FUNCTION public.${q(guardName)}() RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN RAISE EXCEPTION 'Website database is archived read-only for database consolidation' USING ERRCODE='55000'; END;
      $body$`),
    ...tables.map((table) => sql(`CREATE TRIGGER ${q(guardName)}
      BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${qualified(table)}
      FOR EACH STATEMENT EXECUTE FUNCTION public.${q(guardName)}()`)),
  ], options(false));
  console.log('Old website database writes are paused; existing records remain readable.');
}

function readEnv(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

function argsFrom(argv) {
  const args = { sourceEnv: '.env.merge-audit', targetEnv: '../Uudam-Chatbot/.env.local' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (['--prepare', '--apply', '--verify', '--freeze-source', '--unfreeze-source'].includes(arg)) {
      if (args.mode) throw new Error('Select exactly one operation.');
      args.mode = arg.slice(2);
    } else if (['--source-env', '--target-env', '--directory'].includes(arg)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error('An argument value is missing.');
      args[arg === '--source-env' ? 'sourceEnv' : arg === '--target-env' ? 'targetEnv' : 'directory'] = value;
    } else throw new Error('Unknown consolidation argument.');
  }
  if (!args.mode || !args.directory) throw new Error('Provide an operation and --directory inside tmp.');
  const dir = resolve(args.directory);
  if (!dir.startsWith(resolve('tmp') + '\\') && !dir.startsWith(resolve('tmp') + '/')) {
    throw new Error('Backups must stay inside the ignored tmp directory.');
  }
  return { ...args, directory: dir };
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  const sourceEnv = readEnv(args.sourceEnv);
  const targetEnv = readEnv(args.targetEnv);
  const sourceUrl = sourceEnv.DATABASE_URL;
  const targetUrl = targetEnv.NEON_DATABASE_URL || targetEnv.DATABASE_URL;
  if (!sourceUrl || !targetUrl) throw new Error('Source or target connection is missing.');
  if (databaseIdentity(sourceUrl) === databaseIdentity(targetUrl)) throw new Error('Source and target are the same database.');
  const source = neon(sourceUrl);
  const target = neon(targetUrl);
  mkdirSync(args.directory, { recursive: true });
  const backupPath = resolve(args.directory, 'source-backup.json');
  const manifestPath = resolve(args.directory, 'manifest.json');
  if (args.mode === 'unfreeze-source') {
    const [tables] = await source.transaction([source(inventorySql)], options(true));
    await source.transaction([
      ...tables.map((table) => source(`DROP TRIGGER IF EXISTS ${q(guardName)} ON ${qualified(table)}`)),
      source(`DROP FUNCTION IF EXISTS public.${q(guardName)}()`),
    ], options(false));
    console.log('Source writes restored; no application records were changed.');
    return;
  }
  if (args.mode === 'freeze-source') {
    if (!existsSync(backupPath)) throw new Error('Create a source export before pausing writes.');
    return freezeSource(source);
  }
  if (args.mode === 'prepare') {
    if (existsSync(backupPath)) throw new Error('Backup already exists. Use a fresh directory to preserve it.');
    const backup = await exportSource(source);
    createSchemaStatements(backup);
    const data = JSON.stringify(backup);
    const targetBefore = await readSnapshot(target);
    writeFileSync(backupPath, data, { flag: 'wx', mode: 0o600 });
    writeFileSync(resolve(args.directory, 'target-before.json'), JSON.stringify(targetBefore), { flag: 'wx', mode: 0o600 });
    writeFileSync(manifestPath, JSON.stringify({ preparedAt: new Date().toISOString(), backupSha256: hash(data),
      sourceIdentityHash: hash(databaseIdentity(sourceUrl)), targetIdentityHash: hash(databaseIdentity(targetUrl)),
      tables: backup.tables.length, rows: backup.tables.reduce((sum, table) => sum + table.count, 0),
    }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ status: 'prepared', tables: backup.tables.length,
      rows: backup.tables.reduce((sum, table) => sum + table.count, 0), directory: args.directory }));
    return;
  }
  const raw = readFileSync(backupPath, 'utf8');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.backupSha256 !== hash(raw)) throw new Error('Backup checksum mismatch.');
  if (manifest.sourceIdentityHash !== hash(databaseIdentity(sourceUrl))) throw new Error('Source connection differs from the backup.');
  if (args.mode === 'apply' && manifest.targetIdentityHash !== hash(databaseIdentity(targetUrl))) {
    throw new Error('Target connection differs from the prepared copy plan.');
  }
  const backup = JSON.parse(raw);
  const tables = args.mode === 'apply' ? await applyCopy(target, backup) : await verifyData(target, backup);
  const report = { verifiedAt: new Date().toISOString(), operation: args.mode,
    tables, totalRows: tables.reduce((sum, table) => sum + table.rows, 0) };
  writeFileSync(resolve(args.directory, `verification-${hash(databaseIdentity(targetUrl)).slice(0, 8)}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const safe = error instanceof Error && error.constructor === Error;
    console.error(safe ? error.message : `Consolidation failed (${typeof error?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'driver error'}); sensitive details withheld. Verify state before retrying.`);
    process.exitCode = 1;
  });
}

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { neon } from "@neondatabase/serverless";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const readOptions = {
  readOnly: true,
  isolationLevel: "RepeatableRead",
};

export function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function compareRows(source, target, keyed) {
  if (keyed) {
    const byKey = new Map(target.map((row) => [row.key, row.content]));
    let identical = 0;
    let missing = 0;
    let conflicting = 0;
    for (const row of source) {
      if (!byKey.has(row.key)) missing++;
      else if (byKey.get(row.key) === row.content) identical++;
      else conflicting++;
    }
    return { identical, missing, conflicting, targetOnly: target.length - identical - conflicting };
  }
  // Tables without primary keys need multiset comparison to preserve duplicate rows.
  const remaining = new Map();
  for (const row of target) remaining.set(row.content, (remaining.get(row.content) ?? 0) + 1);
  let identical = 0;
  for (const row of source) {
    const count = remaining.get(row.content) ?? 0;
    if (count > 0) {
      identical++;
      remaining.set(row.content, count - 1);
    }
  }
  return { identical, missing: source.length - identical, conflicting: null, targetOnly: target.length - identical };
}

export const inventorySql = `
SELECT n.nspname::text AS schema, c.relname::text AS name, c.relkind::text AS kind,
  c.relrowsecurity AS row_security,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
    'required', a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid),
    'identity', a.attidentity, 'generated', a.attgenerated) ORDER BY a.attnum)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped), '[]'::jsonb) AS columns,
  COALESCE((SELECT jsonb_agg(a.attname ORDER BY k.ordinality)
    FROM pg_constraint p CROSS JOIN LATERAL unnest(p.conkey) WITH ORDINALITY k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid = p.conrelid AND a.attnum = k.attnum
    WHERE p.conrelid = c.oid AND p.contype = 'p'), '[]'::jsonb) AS primary_key,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('name', p.conname,
    'definition', pg_get_constraintdef(p.oid), 'validated', p.convalidated) ORDER BY p.conname)
    FROM pg_constraint p WHERE p.conrelid = c.oid), '[]'::jsonb) AS constraints
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
  AND c.relkind IN ('r', 'p', 'f') AND NOT c.relispartition
ORDER BY n.nspname, c.relname`;

export const objectsSql = `
SELECT n.nspname::text AS schema, c.relname::text AS name,
  CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view'
    WHEN 'S' THEN 'sequence' WHEN 'i' THEN 'index' WHEN 'I' THEN 'partitioned_index' END AS kind,
  CASE WHEN c.relkind IN ('v','m') THEN md5(pg_get_viewdef(c.oid))
    WHEN c.relkind IN ('i','I') THEN md5(pg_get_indexdef(c.oid)) ELSE NULL END AS definition_hash
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
  AND c.relkind IN ('v','m','S','i','I')
UNION ALL
SELECT n.nspname::text, t.typname::text, 'enum', md5(string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder))
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
GROUP BY n.nspname, t.typname
UNION ALL
SELECT n.nspname::text, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
  'routine', md5(p.prosrc)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
UNION ALL
SELECT n.nspname::text, c.relname || '.' || t.tgname, 'trigger', md5(pg_get_triggerdef(t.oid))
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
ORDER BY schema, kind, name`;

export async function readSnapshot(sql) {
  const options = () => ({ ...readOptions, fetchOptions: { signal: AbortSignal.timeout(60_000) } });
  const [tables] = await sql.transaction([sql(inventorySql)], options());
  if (tables.some((table) => table.kind === 'f' || table.row_security)) {
    throw new Error('Foreign tables or row security require a separate audit to confirm full data visibility.');
  }
  const queries = tables.map((table) => {
    const key = table.primary_key.length
      ? `md5(jsonb_build_array(${table.primary_key.map((column) => `t.${quoteIdentifier(column)}`).join(', ')})::text)`
      : 'NULL::text';
    return sql(`SELECT ${key} AS key, md5(to_jsonb(t)::text) AS content
      FROM ${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)} t`);
  });
  const tripTable = tables.find((table) => table.schema === 'public' && table.name === 'Trip');
  const canonicalTable = tables.find((table) => table.schema === 'public' && table.name === 'travel_trip_entries');
  const tripQuery = tripTable?.columns.some((column) => column.name === 'sourceTripId')
    ? 'SELECT md5("sourceTripId") AS source_key FROM public."Trip"' : 'SELECT NULL::text AS source_key WHERE false';
  const canonicalQuery = canonicalTable?.columns.some((column) => column.name === 'id')
    ? 'SELECT md5(id::text) AS source_key FROM public.travel_trip_entries' : 'SELECT NULL::text AS source_key WHERE false';
  const [, inventory, objects, ...results] = await sql.transaction([
    sql("SET LOCAL TIME ZONE 'UTC'"), sql(inventorySql), sql(objectsSql),
    ...queries, sql(tripQuery), sql(canonicalQuery),
  ], options());
  if (JSON.stringify(tables) !== JSON.stringify(inventory)) {
    throw new Error('The schema changed during discovery. Rerun the audit.');
  }
  return { tables, objects, rows: results.slice(0, tables.length),
    tripLinks: results[tables.length], canonicalKeys: results[tables.length + 1] };
}

async function snapshot(url) {
  return readSnapshot(neon(url));
}

function envFile(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

function localEnv(root) {
  return { ...envFile(resolve(root, '.env')), ...envFile(resolve(root, '.env.local')) };
}

export function parseArgs(args) {
  const files = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') return { ...files, help: true };
    if (arg !== '--source-env' && arg !== '--target-env') {
      throw new Error('Only --source-env, --target-env and --help are supported. This audit has no write mode.');
    }
    const value = args[++i];
    if (!value || value.startsWith('--') || !existsSync(resolve(value))) {
      throw new Error(`A readable env file is required for ${arg}.`);
    }
    files[arg === '--source-env' ? 'source' : 'target'] = resolve(value);
  }
  return { ...files, help: false };
}

export function databaseIdentity(url) {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('A PostgreSQL database URL is required.');
  }
  return `${parsed.hostname.replace(/-pooler(?=\.)/, '')}:${parsed.port || '5432'}${parsed.pathname}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Read-only booking database audit. Usage: npm run db:audit-merge -- [--source-env PATH] [--target-env PATH]');
    return;
  }
  const sourceEnv = args.source ? envFile(args.source) : localEnv(projectRoot);
  const targetEnv = args.target ? envFile(args.target) : localEnv(resolve(projectRoot, '../Uudam-Chatbot'));
  const sourceUrl = args.source
    ? sourceEnv.DATABASE_URL || sourceEnv.NEON_DATABASE_URL
    : process.env.BOOKING_SOURCE_DATABASE_URL || process.env.DATABASE_URL || sourceEnv.DATABASE_URL;
  const targetUrl = args.target
    ? targetEnv.NEON_DATABASE_URL || targetEnv.DATABASE_URL
    : process.env.CHATBOT_TARGET_DATABASE_URL || targetEnv.NEON_DATABASE_URL || targetEnv.DATABASE_URL;
  if (!targetUrl) throw new Error('Chatbot target connection is missing. Use --target-env or CHATBOT_TARGET_DATABASE_URL.');
  if (sourceUrl && databaseIdentity(sourceUrl) === databaseIdentity(targetUrl)) {
    throw new Error('Source and target appear to be the same database. Confirm the connections before continuing.');
  }
  console.error('Reading chatbot target in read-only transactions...');
  const target = await snapshot(targetUrl);
  if (sourceUrl) console.error('Reading booking source in read-only transactions...');
  const source = sourceUrl ? await snapshot(sourceUrl) : null;
  const canonicalKeys = new Set(target.canonicalKeys.map((row) => row.source_key));
  const tableName = (table) => `${table.schema}.${table.name}`;
  const tableReports = source?.tables.map((table, i) => {
    const targetIndex = target.tables.findIndex((other) => tableName(other) === tableName(table));
    const other = target.tables[targetIndex];
    const compatibleKeys = !!other && JSON.stringify(table.primary_key) === JSON.stringify(other.primary_key);
    return {
      table: tableName(table),
      sourceRows: source.rows[i].length,
      targetRows: other ? target.rows[targetIndex].length : 0,
      action: !other ? 'create table and copy after approval' : 'review overlap before import',
      schemaMatches: other ? JSON.stringify(table) === JSON.stringify(other) : null,
      comparison: !other ? { missing: source.rows[i].length, identical: 0, conflicting: 0, targetOnly: 0 }
        : compatibleKeys ? compareRows(source.rows[i], target.rows[targetIndex], table.primary_key.length > 0) : null,
      sourceSchema: table,
      targetSchema: other ?? null,
    };
  }) ?? null;
  console.log(JSON.stringify({
    mode: 'read-only',
    status: source ? 'audit complete; migration requires review' : 'incomplete; source connection missing',
    limitation: 'Fingerprints are preliminary comparisons, not backups or proof of a lossless copy. Each database has its own snapshot. Cross-table trip mapping and unique-key conflicts require further review.',
    source: source ? { tables: tableReports, objects: source.objects } : null,
    tripLinks: source ? {
      websiteTripsWithCanonicalLink: source.tripLinks.filter((row) => row.source_key !== null).length,
      linkedToExistingChatbotTrip: source.tripLinks.filter((row) => canonicalKeys.has(row.source_key)).length,
      websiteTripsWithoutCanonicalLink: source.tripLinks.filter((row) => row.source_key === null).length,
      brokenCanonicalLinks: source.tripLinks.filter((row) => row.source_key !== null && !canonicalKeys.has(row.source_key)).length,
    } : null,
    target: {
      tables: target.tables.map((table, i) => ({ table: tableName(table), rows: target.rows[i].length })),
      objects: target.objects,
    },
  }, null, 2));
  if (!source) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    // Driver errors may contain SQL values or connection details; print only a safe category.
    const safe = error instanceof Error && error.constructor === Error;
    console.error(safe ? error.message : 'Database audit failed. Check connection access; credentials and driver details were withheld.');
    process.exitCode = 1;
  });
}

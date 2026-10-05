import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { compareRows, databaseIdentity, parseArgs, quoteIdentifier, readSnapshot } from '../scripts/audit-database-merge.mjs';

test('audit rejects write arguments', () => {
  assert.throws(() => parseArgs(['--apply']), /no write mode/);
  assert.throws(() => parseArgs(['--source-env']), /env file/);
});

test('every database transaction is read-only and uses repeatable read', async () => {
  const calls = [];
  const sql = (query) => query;
  sql.transaction = async (queries, options) => {
      assert.equal(options.readOnly, true);
      assert.equal(options.isolationLevel, 'RepeatableRead');
      calls.push(queries);
      return queries.map(() => []);
  };
  await readSnapshot(sql);
  assert.equal(calls.length, 2);
  assert.ok(calls.flat().every((query) => /^(SELECT|SET LOCAL TIME ZONE)/.test(query.trim())));
});

test('primary key overlap distinguishes missing rows, conflicts and target-only rows', () => {
  assert.deepEqual(compareRows(
    [{ key: '1', content: 'a' }, { key: '2', content: 'b' }, { key: '3', content: 'c' }],
    [{ key: '1', content: 'a' }, { key: '2', content: 'changed' }, { key: '4', content: 'd' }], true,
  ), { identical: 1, missing: 1, conflicting: 1, targetOnly: 1 });
});

test('tables without primary keys preserve duplicate-row counts', () => {
  assert.deepEqual(compareRows(
    [{ key: null, content: 'a' }, { key: null, content: 'a' }],
    [{ key: null, content: 'a' }, { key: null, content: 'b' }], false,
  ), { identical: 1, missing: 1, conflicting: null, targetOnly: 1 });
});

test('catalogue identifiers are quoted even when they contain quotes', () => {
  assert.equal(quoteIdentifier('odd"table'), '"odd""table"');
});

test('same database detection handles pooled URLs without exposing passwords', () => {
  assert.equal(databaseIdentity('postgresql://user:secret@ep-example-pooler.neon.tech/db?sslmode=require'),
    databaseIdentity('postgres://other:different@ep-example.neon.tech:5432/db'));
  assert.throws(() => databaseIdentity('https://example.com'), /PostgreSQL/);
});

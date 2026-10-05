import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSchemaStatements, exactComparisonQuery, portableTableSchema } from '../scripts/consolidate-databases.mjs';

const table = { schema: 'public', name: 'Sample', kind: 'r', row_security: false,
  columns: [{ name: 'id', type: 'text', default: null, required: true, identity: '', generated: '' }],
  constraints: [{ name: 'pk', definition: 'PRIMARY KEY (id)' }] };

test('schema creation never replaces existing data and creates foreign keys last', () => {
  const ddl = createSchemaStatements({ tables: [{ ...table, name: 'Child', constraints: [
    { name: 'fk', definition: 'FOREIGN KEY (id) REFERENCES "Sample"(id)' },
  ] }, table], enums: [{ schema: 'public', name: 'State', labels: ["can't"] }], indexes: [] });
  assert.ok(ddl.enums[0].includes("'can''t'"));
  assert.equal(ddl.constraints[0], 'ALTER TABLE "public"."Sample" ADD CONSTRAINT "pk" PRIMARY KEY (id)');
  assert.ok(ddl.constraints[1].includes('FOREIGN KEY'));
  assert.ok(!JSON.stringify(ddl).match(/DELETE|DROP|TRUNCATE|UPDATE/));
});

test('sequence-backed and generated columns fail closed', () => {
  const backup = { tables: [{ ...table, columns: [{ ...table.columns[0], identity: 'a' }] }], enums: [], indexes: [] };
  assert.throws(() => createSchemaStatements(backup), /separate migration/);
});

test('verification compares all values and duplicate multiplicities on the server', () => {
  const sql = exactComparisonQuery(table);
  assert.equal((sql.match(/EXCEPT ALL/g) || []).length, 2);
  assert.ok(sql.includes('jsonb_populate_recordset(NULL::"public"."Sample", $1::jsonb)'));
  assert.ok(sql.includes('THEN 0 ELSE 1'));
});

test('PostgreSQL 18 NOT NULL catalog entries preserve required columns on PostgreSQL 17', () => {
  const pg18 = { ...table, constraints: [...table.constraints,
    { name: 'Sample_id_not_null', definition: 'NOT NULL id', validated: true }] };
  const ddl = createSchemaStatements({ tables: [pg18], enums: [], indexes: [] });
  assert.ok(ddl.tables[0].includes('"id" text NOT NULL'));
  assert.equal(ddl.constraints.length, 1);
  assert.deepEqual(portableTableSchema(pg18), table);
  assert.throws(() => createSchemaStatements({ tables: [{ ...pg18, constraints: [
    { name: 'nn', definition: 'NOT NULL id', validated: false }], }], enums: [], indexes: [] }), /Unvalidated/);
});

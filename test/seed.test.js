import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { buildSeed } from '../server/seed.js';

function tmpFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-seed-'));
  return path.join(dir, name);
}

function read(file, sql) {
  const db = new Database(file, { readonly: true });
  const rows = db.prepare(sql).all();
  db.close();
  return rows;
}

test('buildSeed genera 5000 usuarios y 400000 pedidos', () => {
  const file = tmpFile('seed.db');

  const counts = buildSeed({ file });

  assert.deepEqual(counts, { usuarios: 5000, pedidos: 400000 });
  assert.equal(read(file, 'SELECT COUNT(*) AS c FROM usuarios')[0].c, 5000);
  assert.equal(read(file, 'SELECT COUNT(*) AS c FROM pedidos')[0].c, 400000);
});

test('buildSeed es determinista entre corridas', () => {
  const a = tmpFile('a.db');
  const b = tmpFile('b.db');

  buildSeed({ file: a });
  buildSeed({ file: b });

  const sample = (f) => read(f, 'SELECT * FROM usuarios WHERE id IN (1, 2500, 5000) ORDER BY id')
    .concat(read(f, 'SELECT * FROM pedidos WHERE id IN (1, 199999, 400000) ORDER BY id'));

  assert.deepEqual(sample(a), sample(b));
});

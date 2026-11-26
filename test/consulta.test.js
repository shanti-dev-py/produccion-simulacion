import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSeed } from '../server/seed.js';
import { ejecutar } from '../server/consulta.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-consulta-'));
const FILE = path.join(TMP, 'data.db');

before(() => {
  buildSeed({ file: FILE, usuarios: 10, pedidos: 100 });
});

test('PRAGMA se rechaza antes de tocar la base', async () => {
  const result = await ejecutar('PRAGMA table_info(usuarios)', { file: FILE });

  assert.equal(result.ok, false);
  assert.match(result.error, /no permitida/);
});

test('varias sentencias se rechazan enteras', async () => {
  const result = await ejecutar('SELECT 1; SELECT 2', { file: FILE });

  assert.equal(result.ok, false);
  assert.match(result.error, /una sola sentencia/);
});

test('un SELECT devuelve filas y milisegundos', async () => {
  const result = await ejecutar('SELECT COUNT(*) AS c FROM usuarios', { file: FILE });

  assert.equal(result.ok, true);
  assert.equal(result.filas, 1);
  assert.equal(result.rows[0].c, 10);
  assert.ok(result.ms >= 0);
});

test('una consulta sin fin se corta por timeout', async () => {
  const result = await ejecutar(
    'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT COUNT(*) FROM c',
    { file: FILE, timeoutMs: 300 },
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /timeout/);
});

test('un DELETE se permite y reporta las filas afectadas', async () => {
  const result = await ejecutar("DELETE FROM pedidos WHERE usuario_id = 3", { file: FILE });

  assert.equal(result.ok, true);
  assert.ok(result.filas > 0);
});

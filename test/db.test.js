import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSeed } from '../server/seed.js';
import { openDb } from '../server/db.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-db-'));
const SEED = path.join(TMP, 'seed.db');
let next = 0;

before(() => {
  buildSeed({ file: SEED });
});

function fixture() {
  next += 1;
  return openDb({ file: path.join(TMP, `data-${next}.db`), seed: SEED });
}

test('usuarios pagina y reporta el total', () => {
  const db = fixture();

  const page = db.usuarios({ page: 1, limit: 5 });

  assert.equal(page.rows.length, 5);
  assert.equal(page.total, 5000);
  assert.equal(page.page, 1);
  db.close();
});

test('una página fuera de rango devuelve vacío sin romper', () => {
  const db = fixture();

  const page = db.usuarios({ page: 999, limit: 25 });

  assert.deepEqual(page.rows, []);
  assert.equal(page.total, 5000);
  db.close();
});

test('pedidos filtra por usuario', () => {
  const db = fixture();

  const page = db.pedidos({ page: 1, limit: 50, usuarioId: 1 });

  assert.ok(page.rows.length > 0);
  assert.ok(page.rows.every((pedido) => pedido.usuario_id === 1));
  db.close();
});

test('reset restaura los datos después de borrar usuarios', () => {
  const db = fixture();

  db.deleteUsuarios();
  assert.deepEqual(db.counts(), { usuarios: 0, pedidos: 0 });

  db.reset();

  assert.deepEqual(db.counts(), { usuarios: 5000, pedidos: 400000 });
  db.close();
});

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSeed } from '../server/seed.js';
import { openDb } from '../server/db.js';
import { createLog } from '../server/log.js';
import { createRuntime } from '../server/runtime.js';
import { createApp } from '../server/app.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-api-'));
const SEED = path.join(TMP, 'seed.db');
let next = 0;

before(() => {
  buildSeed({ file: SEED });
});

async function withServer(run) {
  next += 1;
  const db = openDb({ file: path.join(TMP, `api-${next}.db`), seed: SEED });
  const log = createLog({ sink: () => {} });
  const runtime = createRuntime({ db, log });
  const app = createApp({ ...runtime, db, log });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await run({ base, db, log, ...runtime });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await runtime.reportes.matar();
    db.close();
  }
}

test('GET /api/estado reporta el estado y los logs', async () => {
  await withServer(async ({ base }) => {
    const res = await fetch(`${base}/api/estado`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.estado, 'operativa');
    assert.equal(body.disponibilidad, 99.99);
    assert.ok(Array.isArray(body.logs));
    assert.equal(body.counts.usuarios, 5000);
  });
});

test('el reporte cartesiano deja caída y el join recupera', async () => {
  await withServer(async ({ base }) => {
    const caida = await (await fetch(`${base}/api/reportes/cartesiano`, { method: 'POST' })).json();
    assert.equal(caida.estado, 'caida');

    const estado = await (await fetch(`${base}/api/estado`)).json();
    assert.equal(estado.estado, 'caida');
    assert.equal(estado.filas, 2_000_000_000);

    const join = await (await fetch(`${base}/api/reportes/join`, { method: 'POST' })).json();
    assert.equal(join.estado, 'operativa');
    assert.equal(join.filas, 400_000);
  });
});

test('DELETE /api/usuarios deja el sistema vacío sin romper el listado', async () => {
  await withServer(async ({ base }) => {
    const res = await fetch(`${base}/api/usuarios`, { method: 'DELETE' });
    const body = await res.json();
    assert.equal(body.estado, 'vacia');

    const listado = await (await fetch(`${base}/api/usuarios?page=1&limit=5`)).json();
    assert.equal(listado.total, 0);
    assert.deepEqual(listado.rows, []);
  });
});

test('POST /api/consulta devuelve el plan y las filas', async () => {
  await withServer(async ({ base }) => {
    const res = await fetch(`${base}/api/consulta`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sql: 'SELECT * FROM usuarios, pedidos' }),
    });
    const body = await res.json();

    assert.equal(body.plan.producto, true);
    assert.equal(body.plan.filas, 2_000_000_000);
    assert.equal(body.ok, true);
    assert.equal(body.rows.length, 200);
  });
});

test('el reset restaura los datos y el estado', async () => {
  await withServer(async ({ base }) => {
    await fetch(`${base}/api/usuarios`, { method: 'DELETE' });
    const res = await fetch(`${base}/api/incidente/reset`, { method: 'POST' });
    const body = await res.json();

    assert.equal(body.estado, 'operativa');
    const listado = await (await fetch(`${base}/api/usuarios?page=1&limit=5`)).json();
    assert.equal(listado.total, 5000);
  });
});

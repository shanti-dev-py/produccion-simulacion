import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSeed } from '../server/seed.js';
import { openDb } from '../server/db.js';
import { createLog } from '../server/log.js';
import { createMachine } from '../server/machine.js';
import { createReportes } from '../server/reportes.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-reportes-'));
const SEED = path.join(TMP, 'seed.db');

before(() => {
  buildSeed({ file: SEED });
});

async function waitFor(check, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

test('el reporte cartesiano tumba producción sin bloquear el hilo principal', async () => {
  const db = openDb({ file: path.join(TMP, 'data.db'), seed: SEED });
  const log = createLog({ sink: () => {} });
  const reportes = createReportes({ db, log });
  const machine = createMachine({
    log,
    deps: {
      sebas: async () => reportes.cartesiano(),
      join: async () => reportes.join(),
      delete: async () => db.deleteUsuarios(),
    },
  });

  await machine.apply('sebas');

  assert.equal(machine.snapshot().estado, 'caida');
  assert.equal(reportes.estado().activo, true);

  const started = Date.now();
  const counts = db.counts();
  assert.equal(counts.usuarios, 5000);
  assert.ok(Date.now() - started < 500, 'la base sigue respondiendo mientras el worker corre');

  assert.ok(await waitFor(() => reportes.estado().filas >= 187_442), 'el worker reporta progreso');

  await machine.apply('join');

  assert.equal(machine.snapshot().estado, 'operativa');
  assert.equal(machine.snapshot().filas, 400_000);
  assert.equal(reportes.estado().activo, false);
  assert.equal(reportes.estado().filas, 400_000);
  assert.ok(reportes.estado().ms < 2000, 'el JOIN vuelve en milisegundos');

  db.close();
});

test('matar deja el worker apagado sin tocar los datos', async () => {
  const db = openDb({ file: path.join(TMP, 'data-2.db'), seed: SEED });
  const reportes = createReportes({ db, log: createLog({ sink: () => {} }) });

  reportes.cartesiano();
  await reportes.matar();

  assert.equal(reportes.estado().activo, false);
  assert.equal(db.counts().pedidos, 400_000);
  db.close();
});

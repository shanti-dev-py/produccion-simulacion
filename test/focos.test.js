import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSeed } from '../server/seed.js';
import { openDb } from '../server/db.js';
import { createLog } from '../server/log.js';
import { createRuntime } from '../server/runtime.js';
import { ejecutar } from '../server/consulta.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-focos-'));
const SEED = path.join(TMP, 'seed.db');
let next = 0;

before(() => {
  buildSeed({ file: SEED, usuarios: 50, pedidos: 200 });
});

function fixture() {
  next += 1;
  return openDb({ file: path.join(TMP, `data-${next}.db`), seed: SEED });
}

test('reset con el worker vivo deja la base y el log limpios', async () => {
  const db = fixture();
  const log = createLog({ sink: () => {} });
  const runtime = createRuntime({ db, log });

  await runtime.machine.apply('sebas');
  const generacionAntes = log.generacion;

  await runtime.machine.apply('reset');

  assert.equal(runtime.reportes.estado().activo, false);
  assert.deepEqual(db.counts(), { usuarios: 50, pedidos: 200 });
  assert.ok(log.generacion > generacionAntes, 'el log sube de generación');
  const rojas = log.lines(0).filter((linea) => ['warn', 'error', 'fatal'].includes(linea.level));
  assert.deepEqual(rojas, []);
  db.close();
});

test('una sentencia destructiva escondida se rechaza entera', async () => {
  const db = fixture();

  const resultado = await ejecutar('SELECT 1; DROP TABLE usuarios', { file: db.path });
  assert.equal(resultado.ok, false);

  const sobrevive = await ejecutar('SELECT COUNT(*) AS c FROM usuarios', { file: db.path });
  assert.equal(sobrevive.ok, true);
  assert.equal(sobrevive.rows[0].c, 50);
  db.close();
});

test('DROP se rechaza antes de tocar la base', async () => {
  const db = fixture();

  const resultado = await ejecutar('DROP TABLE pedidos', { file: db.path });

  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /no permitida/);
  assert.equal(db.counts().pedidos, 200);
  db.close();
});

test('al abrir la base se descarta un estado vacío de la toma anterior', () => {
  const file = path.join(TMP, 'reabierta.db');
  const primera = openDb({ file, seed: SEED });
  primera.deleteUsuarios();
  primera.close();

  const segunda = openDb({ file, seed: SEED });

  assert.deepEqual(segunda.counts(), { usuarios: 50, pedidos: 200 });
  segunda.close();
});

test('el reporte se puede volver a disparar después de terminar solo', async () => {
  const db = fixture();
  const log = createLog({ sink: () => {} });
  const runtime = createRuntime({ db, log });

  runtime.reportes.cartesiano();
  const espera = Date.now() + 5000;
  while (runtime.reportes.estado().activo && Date.now() < espera) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(runtime.reportes.estado().activo, false);

  runtime.reportes.cartesiano();
  assert.equal(runtime.reportes.estado().activo, true);

  await runtime.reportes.matar();
  db.close();
});

test('un join sobre la base vacía informa cero filas y no cuatrocientas mil', async () => {
  const db = fixture();
  const log = createLog({ sink: () => {} });
  const runtime = createRuntime({ db, log });

  db.deleteUsuarios();
  await runtime.machine.apply('join');

  assert.equal(runtime.machine.snapshot().filas, 0);
  assert.equal(runtime.machine.snapshot().estado, 'operativa');
  db.close();
});

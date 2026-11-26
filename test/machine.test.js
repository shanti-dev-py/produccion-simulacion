import test from 'node:test';
import assert from 'node:assert/strict';
import { createMachine } from '../server/machine.js';
import { createLog } from '../server/log.js';

const silentLog = () => createLog({ sink: () => {} });

test('la máquina arranca operativa con 99.99 y 400.000 filas', () => {
  const machine = createMachine({ log: silentLog() });

  const state = machine.snapshot();

  assert.equal(state.estado, 'operativa');
  assert.equal(state.disponibilidad, 99.99);
  assert.equal(state.filas, 400_000);
});

test('sebas deja caida con dos mil millones de filas', async () => {
  const machine = createMachine({ log: silentLog() });

  await machine.apply('sebas');

  const state = machine.snapshot();
  assert.equal(state.estado, 'caida');
  assert.equal(state.filas, 2_000_000_000);
  assert.equal(state.disponibilidad, 41.2);
});

test('join recupera y ejecuta el trabajo de recuperación', async () => {
  let restored = false;
  const machine = createMachine({
    log: silentLog(),
    deps: { join: async () => { restored = true; } },
  });

  await machine.apply('sebas');
  await machine.apply('join');

  assert.equal(restored, true);
  assert.equal(machine.snapshot().estado, 'operativa');
  assert.equal(machine.snapshot().filas, 400_000);
});

test('delete deja el conjunto vacío', async () => {
  const machine = createMachine({ log: silentLog() });

  await machine.apply('delete');

  assert.equal(machine.snapshot().estado, 'vacia');
  assert.equal(machine.snapshot().disponibilidad, 0);
  assert.equal(machine.snapshot().filas, 0);
});

test('reiniciar no cambia el estado', async () => {
  const machine = createMachine({ log: silentLog() });

  await machine.apply('sebas');
  await machine.apply('reiniciar');

  assert.equal(machine.snapshot().estado, 'caida');
});

test('un evento desconocido se rechaza sin tocar el estado', async () => {
  const machine = createMachine({ log: silentLog() });

  await assert.rejects(() => machine.apply('apagar-todo'), /evento desconocido/);
  assert.equal(machine.snapshot().estado, 'operativa');
});

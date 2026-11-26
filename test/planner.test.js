import test from 'node:test';
import assert from 'node:assert/strict';
import { estimar } from '../server/planner.js';

const COUNTS = { usuarios: 5000, pedidos: 400_000 };

test('un FROM con dos tablas y sin filtro es producto cartesiano', () => {
  const plan = estimar('SELECT * FROM usuarios, pedidos', COUNTS);

  assert.equal(plan.producto, true);
  assert.equal(plan.filas, 2_000_000_000);
  assert.deepEqual(plan.tablas, ['usuarios', 'pedidos']);
});

test('con ON deja de ser producto y estima la tabla más grande', () => {
  const plan = estimar('SELECT * FROM usuarios u JOIN pedidos p ON u.id = p.usuario_id', COUNTS);

  assert.equal(plan.producto, false);
  assert.equal(plan.filas, 400_000);
});

test('una sola tabla estima su total', () => {
  const plan = estimar('SELECT * FROM usuarios WHERE ciudad = "Cali"', COUNTS);

  assert.equal(plan.producto, false);
  assert.equal(plan.filas, 5000);
  assert.deepEqual(plan.tablas, ['usuarios']);
});

test('una tabla desconocida no inventa un conteo', () => {
  const plan = estimar('SELECT 1', COUNTS);

  assert.deepEqual(plan.tablas, []);
  assert.equal(plan.filas, null);
});

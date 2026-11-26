import test from 'node:test';
import assert from 'node:assert/strict';
import { createLog } from '../server/log.js';

test('createLog escribe al sink y guarda la línea con seq', () => {
  const out = [];
  const log = createLog({ sink: (text) => out.push(text) });

  log.info('servidor arriba');

  assert.match(out[0], /INFO/);
  assert.match(out[0], /servidor arriba/);
  const [line] = log.lines(0);
  assert.equal(line.seq, 1);
  assert.equal(line.level, 'info');
  assert.equal(line.msg, 'servidor arriba');
});

test('lines(since) devuelve solo lo nuevo', () => {
  const log = createLog({ sink: () => {} });

  log.info('uno');
  log.warn('dos');
  log.error('tres');

  assert.deepEqual(log.lines(1).map((line) => line.msg), ['dos', 'tres']);
  assert.deepEqual(log.lines(3), []);
});

test('una línea con sql la conserva para la web y la imprime en el terminal', () => {
  const out = [];
  const log = createLog({ sink: (text) => out.push(text) });

  log.warn('sin filtro', { sql: 'SELECT * FROM usuarios, pedidos;' });

  assert.equal(log.lines(0)[0].sql, 'SELECT * FROM usuarios, pedidos;');
  assert.match(out.join('\n'), /SELECT \* FROM usuarios, pedidos;/);
});

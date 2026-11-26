import { formatNumber as fmt } from './log.js';

export const EVENTS = ['sebas', 'join', 'delete', 'reiniciar', 'reset'];

const ESTADOS = {
  operativa: { disponibilidad: 99.99, errorRate: 0.01, filas: 400_000 },
  caida: { disponibilidad: 41.2, errorRate: 74.53, filas: 2_000_000_000 },
  vacia: { disponibilidad: 0, errorRate: 100, filas: 0 },
};

const AFTER = {
  sebas: 'caida',
  join: 'operativa',
  delete: 'vacia',
  reiniciar: null,
  reset: 'operativa',
};

export function createMachine({ log, deps = {} } = {}) {
  let current = 'operativa';
  let desde = new Date().toISOString();
  const listeners = new Set();

  function snapshot() {
    return { estado: current, desde, ...ESTADOS[current] };
  }

  function narrate(event) {
    if (!log) return;
    if (event === 'sebas') {
      log.info('consulta recibida de sebas', { sql: 'SELECT * FROM usuarios, pedidos;' });
      log.warn('sin ON ni WHERE → producto cartesiano');
      log.warn(`|A| x |B| = ${fmt(2_000_000_000)} filas estimadas`);
      log.error('base de datos saturada — el resto de la API deja de responder');
    }
    if (event === 'join') {
      log.info('JOIN aplicado · ON usuarios.id = pedidos.usuario_id');
      log.ok(`producción operativa · ${fmt(400_000)} filas · disponibilidad 99.99 %`);
    }
    if (event === 'delete') {
      log.fatal('DELETE sin WHERE · usuarios = ∅');
    }
    if (event === 'reiniciar') {
      log.info('reinicio solicitado · sin efecto');
    }
    if (event === 'reset') {
      log.ok('sistema restaurado desde la semilla');
    }
  }

  async function apply(event) {
    if (!EVENTS.includes(event)) throw new Error(`evento desconocido: ${event}`);

    if (deps[event]) await deps[event]();

    const next = AFTER[event];
    if (next) {
      current = next;
      desde = new Date().toISOString();
    }

    narrate(event);
    const state = snapshot();
    for (const listener of listeners) listener(state);
    return state;
  }

  return {
    apply,
    snapshot,
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

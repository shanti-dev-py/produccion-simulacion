import { Worker } from 'node:worker_threads';
import Database from 'better-sqlite3';
import { formatNumber as fmt } from './log.js';

export function createReportes({ db, log }) {
  let worker = null;
  let last = { filas: 0, ms: 0, activo: false };
  let ultimoHito = 0;

  function cartesiano() {
    if (worker) return { ...last };

    last = { filas: 0, ms: 0, activo: true };
    ultimoHito = 0;
    worker = new Worker(new URL('./reporte-worker.js', import.meta.url), {
      workerData: { file: db.path },
    });

    worker.on('message', (message) => {
      if (message.type === 'progreso') {
        last = { filas: message.filas, ms: message.ms, activo: true };
        const hito = message.filas === 187_442 || message.filas - ultimoHito >= 1_000_000;
        if (hito) {
          ultimoHito = message.filas;
          log.warn(`${fmt(message.filas)} filas materializadas · ${message.ms} ms`);
        }
      }
      if (message.type === 'fin') {
        last = { filas: message.filas, ms: message.ms, activo: false };
      }
    });

    worker.on('error', (error) => {
      log.error(`reporte abortado · ${error.message}`);
      last = { ...last, activo: false };
      worker = null;
    });

    return { ...last };
  }

  async function join() {
    if (worker) {
      await worker.terminate();
      worker = null;
    }

    const started = Date.now();
    const connection = new Database(db.path, { readonly: true });
    const { c } = connection
      .prepare('SELECT COUNT(*) AS c FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id')
      .get();
    connection.close();

    last = { filas: c, ms: Date.now() - started, activo: false };
    log.ok(`JOIN · ${fmt(c)} filas en ${last.ms} ms`);
    return { ...last };
  }

  async function matar() {
    if (worker) {
      await worker.terminate();
      worker = null;
    }
    last = { filas: 0, ms: 0, activo: false };
  }

  return { cartesiano, join, matar, estado: () => ({ ...last }) };
}

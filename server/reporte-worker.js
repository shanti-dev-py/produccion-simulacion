import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';

const FIRST_PAGE = 187_442;
const PAGE = 250_000;

const db = new Database(workerData.file, { readonly: true, fileMustExist: true });
const page = db.prepare(
  'SELECT u.id AS usuario_id, p.id AS pedido_id FROM usuarios u, pedidos p ORDER BY p.id LIMIT ? OFFSET ?',
);

const started = Date.now();
let offset = 0;
let pageSize = FIRST_PAGE;

for (;;) {
  const rows = page.all(pageSize, offset);
  if (rows.length === 0) break;
  offset += rows.length;
  parentPort.postMessage({ type: 'progreso', filas: offset, ms: Date.now() - started });
  pageSize = PAGE;
}

parentPort.postMessage({ type: 'fin', filas: offset, ms: Date.now() - started });
db.close();

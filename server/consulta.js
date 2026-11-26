import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./consulta-worker.js', import.meta.url));
const PROHIBIDAS = /^\s*(pragma|attach|detach|vacuum|create|drop|alter|truncate|reindex)\b/i;

function unaSolaSentencia(sql) {
  const sinLiterales = sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return !/;\s*\S/.test(sinLiterales);
}

export async function ejecutar(sql, { file, timeoutMs = 4000, maxRows = 200 } = {}) {
  const statement = String(sql ?? '').trim();

  if (!statement) {
    return { ok: false, filas: 0, rows: [], ms: 0, error: 'consulta vacía' };
  }
  if (PROHIBIDAS.test(statement)) {
    return { ok: false, filas: 0, rows: [], ms: 0, error: 'sentencia no permitida' };
  }
  if (!unaSolaSentencia(statement)) {
    return { ok: false, filas: 0, rows: [], ms: 0, error: 'solo se permite una sola sentencia' };
  }

  return new Promise((resolve) => {
    const started = Date.now();
    // Un proceso, no un worker: una consulta sin fin bloquea el hilo dentro de
    // una función nativa y `terminate()` no puede interrumpirla. SIGKILL sí.
    const child = fork(SCRIPT, [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execArgv: [],
    });

    let settled = false;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve({ ...payload, ms: Date.now() - started });
    };

    const timer = setTimeout(
      () => finish({ ok: false, filas: 0, rows: [], error: `timeout: la consulta superó ${timeoutMs} ms` }),
      timeoutMs,
    );

    child.on('message', finish);
    child.on('error', (error) => finish({ ok: false, filas: 0, rows: [], error: error.message }));
    child.on('exit', (code) => {
      if (!settled) {
        finish({ ok: false, filas: 0, rows: [], error: `la consulta terminó sin resultado (código ${code})` });
      }
    });

    child.send({ file, sql: statement, maxRows });
  });
}

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './seed.js';
import { openDb } from './db.js';
import { createLog, formatNumber as fmt } from './log.js';
import { createRuntime } from './runtime.js';
import { createApp } from './app.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(HERE, '..', 'data');
const SEED = path.join(DATA_DIR, 'seed.db');
const DATA = path.join(DATA_DIR, 'data.db');
const PORT = Number.parseInt(process.env.PORT, 10) || 4000;

if (!fs.existsSync(SEED)) {
  process.stdout.write('aurora  generando semilla (5.000 usuarios · 400.000 pedidos)…\n');
  buildSeed({ file: SEED });
}

const log = createLog();
const db = openDb({ file: DATA, seed: SEED });
const runtime = createRuntime({ db, log });
const app = createApp({ ...runtime, db, log });

const COMMANDS = {
  estado: () => {
    const state = runtime.machine.snapshot();
    log.info(
      `${state.estado} · disponibilidad ${state.disponibilidad}% · ${fmt(state.filas)} filas · error ${state.errorRate}%`,
    );
  },
  sebas: () => runtime.machine.apply('sebas'),
  join: () => runtime.machine.apply('join'),
  delete: () => runtime.machine.apply('delete'),
  reiniciar: () => runtime.machine.apply('reiniciar'),
  reset: () => runtime.machine.apply('reset'),
  ayuda: () => {
    log.info('comandos: estado · sebas · join · delete · reiniciar · reset · ayuda · clear');
  },
  clear: () => process.stdout.write('\x1b[2J\x1b[H'),
};

function banner() {
  const width = 54;
  const row = (text) => `│  ${text.padEnd(width)}│`;
  const rule = '─'.repeat(width + 2);
  process.stdout.write(`\n┌${rule}┐\n`);
  process.stdout.write(`${row('AURORA · operaciones')}\n`);
  process.stdout.write(`${row(`panel    http://localhost:${PORT}`)}\n`);
  process.stdout.write(`${row(`api      http://localhost:${PORT}/docs`)}\n`);
  process.stdout.write(`└${rule}┘\n\n`);
}

function startRepl() {
  if (!process.stdin.isTTY) return;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'aurora> ',
  });

  rl.prompt();
  rl.on('line', async (line) => {
    const command = line.trim().toLowerCase();
    if (!command) return rl.prompt();

    const run = COMMANDS[command];
    if (!run) {
      log.warn(`comando desconocido: ${command} · probá "ayuda"`);
      return rl.prompt();
    }

    try {
      await run();
    } catch (error) {
      log.error(error.message);
    }
    rl.prompt();
  });

  rl.on('close', () => {
    process.stdout.write('\n');
    process.exit(0);
  });
}

const server = app.listen(PORT, () => {
  banner();
  log.ok(`aurora escuchando en el puerto ${PORT}`);
  log.info('escribí "ayuda" para manejar el sistema desde acá');
  startRepl();
});

function shutdown(signal) {
  log.warn(`${signal} · apagando`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

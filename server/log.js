const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  info: '\x1b[36m',
  ok: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[1;41;97m',
};

const LABEL = {
  info: 'INFO ',
  ok: 'OK   ',
  warn: 'WARN ',
  error: 'ERROR',
  fatal: 'FATAL',
};

const BUFFER_SIZE = 400;

export function formatNumber(value) {
  return Number(value).toLocaleString('es-CO');
}

export function createLog({
  sink = (text) => process.stdout.write(`${text}\n`),
  clock = () => new Date(),
} = {}) {
  const buffer = [];
  let seq = 0;
  let generacion = 1;
  const useColor = Boolean(process.stdout.isTTY || process.env.FORCE_COLOR);

  function paint(level, text) {
    return useColor ? `${ANSI[level]}${text}${ANSI.reset}` : text;
  }

  function stamp(date) {
    const dos = (valor) => String(valor).padStart(2, '0');
    const text = `${dos(date.getHours())}:${dos(date.getMinutes())}:${dos(date.getSeconds())}`;
    return useColor ? `${ANSI.dim}${text}${ANSI.reset}` : text;
  }

  function write(level, msg, extra = {}) {
    seq += 1;
    const at = clock();
    const line = { seq, ts: at.toISOString(), level, msg };
    if (extra.sql) line.sql = extra.sql;

    buffer.push(line);
    if (buffer.length > BUFFER_SIZE) buffer.shift();

    sink(`${stamp(at)} ${paint(level, LABEL[level])} ${msg}`);
    if (extra.sql) sink(`${useColor ? `${ANSI.dim}             SQL ${extra.sql}${ANSI.reset}` : `             SQL ${extra.sql}`}`);
    return line;
  }

  return {
    info: (msg, extra) => write('info', msg, extra),
    ok: (msg, extra) => write('ok', msg, extra),
    warn: (msg, extra) => write('warn', msg, extra),
    error: (msg, extra) => write('error', msg, extra),
    fatal: (msg, extra) => write('fatal', msg, extra),
    lines: (since = 0) => buffer.filter((line) => line.seq > since),
    clear() {
      buffer.length = 0;
      generacion += 1;
    },
    get seq() {
      return seq;
    },
    get generacion() {
      return generacion;
    },
  };
}

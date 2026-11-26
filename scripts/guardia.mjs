import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const BASE = process.env.AURORA_URL ?? 'http://localhost:4000';
const ARCHIVO = process.env.AURORA_GUARDIA ?? '/tmp/aurora-guardia.json';
const LOG = process.env.AURORA_GUARDIA_LOG ?? '/tmp/aurora-guardia.log';

const numero = (valor) => Number(valor ?? 0).toLocaleString('es-CO');

const INCIDENTES = new Set(['caida', 'vacia', 'sin-respuesta']);

const AVISOS = {
  caida: {
    titulo: '¡Se cayó producción!',
    cuerpo: (estado) =>
      `${numero(estado.filas)} filas · disponibilidad ${estado.disponibilidad} % · error ${estado.errorRate} %`,
    critico: true,
    icono: 'dialog-error',
  },
  operativa: {
    titulo: 'Producción operativa',
    cuerpo: (estado) => `${numero(estado.filas)} filas · disponibilidad ${estado.disponibilidad} %`,
    critico: false,
    icono: 'dialog-information',
  },
  vacia: {
    titulo: 'Usuarios borrados',
    cuerpo: () => 'DELETE sin WHERE · usuarios = ∅ · disponibilidad 0 %',
    critico: true,
    icono: 'dialog-error',
  },
  'sin-respuesta': {
    titulo: 'Producción sin respuesta',
    cuerpo: () => 'la API dejó de contestar',
    critico: true,
    icono: 'dialog-error',
  },
};

function leerAnterior() {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
  } catch {
    return null;
  }
}

function guardar(estado) {
  fs.writeFileSync(ARCHIVO, JSON.stringify({ estado: estado.estado, ts: new Date().toISOString() }));
}

async function consultar() {
  try {
    const respuesta = await fetch(`${BASE}/api/estado`, { signal: AbortSignal.timeout(2000) });
    if (!respuesta.ok) return { estado: 'sin-respuesta', filas: 0, disponibilidad: 0, errorRate: 100 };
    return await respuesta.json();
  } catch {
    return { estado: 'sin-respuesta', filas: 0, disponibilidad: 0, errorRate: 100 };
  }
}

function anotar(linea) {
  process.stdout.write(`${new Date().toISOString()} ${linea}\n`);
  try {
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${linea}\n`);
  } catch {
    // el log es un extra
  }
}

async function notificar(aviso, cuerpo) {
  const hints = aviso.critico ? "{'urgency': <byte 2>}" : "{'urgency': <byte 1>}";
  const argumentos = [
    'call',
    '--session',
    '--dest',
    'org.freedesktop.Notifications',
    '--object-path',
    '/org/freedesktop/Notifications',
    '--method',
    'org.freedesktop.Notifications.Notify',
    'Aurora',
    '0',
    aviso.icono,
    aviso.titulo,
    cuerpo,
    '[]',
    hints,
    '6000',
  ];

  try {
    // gdbus habla con el demonio sin libnotify, que en este equipo está roto.
    await run('gdbus', argumentos, { timeout: 3000 });
    return true;
  } catch {
    try {
      await run(
        'notify-send',
        ['-a', 'Aurora', '-u', aviso.critico ? 'critical' : 'normal', '-i', aviso.icono, aviso.titulo, cuerpo],
        { timeout: 3000 },
      );
      return true;
    } catch {
      return false;
    }
  }
}

// El servidor manda el estado ya conocido; el vigilante (cada minuto) lo pide.
const actual = process.env.AURORA_GUARDIA_ESTADO
  ? JSON.parse(process.env.AURORA_GUARDIA_ESTADO)
  : await consultar();

const anterior = leerAnterior();

if (!anterior) {
  guardar(actual);
  anotar(`guardián en línea · estado inicial: ${actual.estado}`);
  process.exit(0);
}

if (anterior.estado === actual.estado) process.exit(0);

const seRecupera = INCIDENTES.has(anterior.estado) && actual.estado === 'operativa';
const esIncidente = INCIDENTES.has(actual.estado);

// Un reset también deja el sistema operativo: eso no es noticia.
if (!esIncidente && !seRecupera) {
  guardar(actual);
  process.exit(0);
}

const aviso = AVISOS[actual.estado];
const cuerpo = aviso.cuerpo(actual);

if (!(await notificar(aviso, cuerpo))) {
  anotar('no se pudo mostrar la notificación del escritorio');
}

anotar(`${anterior.estado} → ${actual.estado} · ${aviso.titulo} · ${cuerpo}`);
guardar(actual);

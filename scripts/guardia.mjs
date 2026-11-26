import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const BASE = process.env.AURORA_URL ?? 'http://localhost:4000';
const ARCHIVO = process.env.AURORA_GUARDIA ?? '/tmp/aurora-guardia.json';
const LOG = process.env.AURORA_GUARDIA_LOG ?? '/tmp/aurora-guardia.log';

const numero = (valor) => Number(valor ?? 0).toLocaleString('es-CO');

const AVISOS = {
  caida: {
    titulo: '¡Se cayó producción!',
    cuerpo: (estado) =>
      `${numero(estado.filas)} filas · disponibilidad ${estado.disponibilidad} % · error ${estado.errorRate} %`,
    urgencia: 'critical',
    icono: 'dialog-error',
  },
  operativa: {
    titulo: 'Producción operativa',
    cuerpo: (estado) => `${numero(estado.filas)} filas · disponibilidad ${estado.disponibilidad} %`,
    urgencia: 'normal',
    icono: 'dialog-information',
  },
  vacia: {
    titulo: 'Usuarios borrados',
    cuerpo: () => 'DELETE sin WHERE · usuarios = ∅ · disponibilidad 0 %',
    urgencia: 'critical',
    icono: 'dialog-error',
  },
  'sin-respuesta': {
    titulo: 'Producción sin respuesta',
    cuerpo: () => 'la API dejó de contestar',
    urgencia: 'critical',
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
  const texto = `${new Date().toISOString()} ${linea}\n`;
  fs.appendFileSync(LOG, texto);
  process.stdout.write(texto);
}

async function notificar(aviso, cuerpo) {
  try {
    // gdbus habla con el demonio de notificaciones sin libnotify, que en este
    // equipo está roto (`notify-send: symbol lookup error`).
    await run('gdbus', [
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
      '{}',
      '6000',
    ]);
    return true;
  } catch {
    try {
      await run('notify-send', ['-a', 'Aurora', '-u', aviso.urgencia, '-i', aviso.icono, aviso.titulo, cuerpo]);
      return true;
    } catch {
      return false;
    }
  }
}

const anterior = leerAnterior();
const actual = await consultar();

if (!anterior) {
  guardar(actual);
  anotar(`guardián en línea · estado inicial: ${actual.estado}`);
  process.exit(0);
}

if (anterior.estado === actual.estado) {
  process.exit(0);
}

const aviso = AVISOS[actual.estado] ?? {
  titulo: `Producción: ${actual.estado}`,
  cuerpo: () => 'cambio de estado',
  urgencia: 'normal',
  icono: 'dialog-information',
};

const cuerpo = aviso.cuerpo(actual);

if (!(await notificar(aviso, cuerpo))) {
  anotar('no se pudo mostrar la notificación del escritorio');
}

anotar(`${anterior.estado} → ${actual.estado} · ${aviso.titulo} · ${cuerpo}`);
guardar(actual);

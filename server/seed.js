import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.join(HERE, '..', 'data', 'seed.db');

const SEED = 20261126;
const NOMBRES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabián', 'Gloria', 'Hugo',
  'Inés', 'Julián', 'Karen', 'Luis', 'Marta', 'Nicolás', 'Olga', 'Pablo',
  'Quena', 'Ramiro', 'Sofía', 'Tomás',
];
const APELLIDOS = [
  'Arango', 'Bermúdez', 'Cifuentes', 'Duarte', 'Escobar', 'Fuentes', 'Gómez',
  'Herrera', 'Isaza', 'Jaramillo', 'Klein', 'Lozano', 'Mejía', 'Naranjo',
  'Ospina', 'Pineda', 'Quintero', 'Restrepo', 'Salazar', 'Tovar',
];
const CIUDADES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga',
  'Pereira', 'Manizales', 'Cúcuta', 'Ibagué', 'Villavicencio', 'Pasto',
];
const ESTADOS = ['pagado', 'pagado', 'pagado', 'enviado', 'enviado', 'entregado', 'cancelado'];
const EPOCH = Date.UTC(2025, 0, 1);

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(offsetMs) {
  return new Date(EPOCH + offsetMs).toISOString();
}

const SCHEMA = `
  CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    ciudad TEXT NOT NULL,
    creado_en TEXT NOT NULL
  );
  CREATE TABLE pedidos (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    total INTEGER NOT NULL,
    estado TEXT NOT NULL,
    creado_en TEXT NOT NULL
  );
  CREATE INDEX idx_pedidos_usuario ON pedidos(usuario_id);
  CREATE INDEX idx_pedidos_creado ON pedidos(creado_en);
`;

export function buildSeed({ file = DEFAULT_FILE, usuarios = 5000, pedidos = 400000 } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const leftover of [file, `${file}-wal`, `${file}-shm`]) {
    if (fs.existsSync(leftover)) fs.rmSync(leftover);
  }

  const db = new Database(file);
  db.exec(SCHEMA);

  const rand = mulberry32(SEED);
  const insertUsuario = db.prepare(
    'INSERT INTO usuarios (id, nombre, email, ciudad, creado_en) VALUES (?, ?, ?, ?, ?)',
  );
  const insertPedido = db.prepare(
    'INSERT INTO pedidos (id, usuario_id, total, estado, creado_en) VALUES (?, ?, ?, ?, ?)',
  );

  const load = db.transaction(() => {
    for (let id = 1; id <= usuarios; id += 1) {
      const nombre = `${NOMBRES[(id * 7) % NOMBRES.length]} ${APELLIDOS[(id * 11) % APELLIDOS.length]}`;
      insertUsuario.run(
        id,
        nombre,
        `usuario${id}@aurora.test`,
        CIUDADES[(id * 5) % CIUDADES.length],
        iso(id * 60 * 60 * 1000),
      );
    }

    for (let id = 1; id <= pedidos; id += 1) {
      insertPedido.run(
        id,
        1 + ((id * 7919) % usuarios),
        5_000 + Math.floor(rand() * 495_000),
        ESTADOS[Math.floor(rand() * ESTADOS.length)],
        iso((id % 365) * 86_400_000 + Math.floor(rand() * 86_400_000)),
      );
    }
  });

  load();
  db.close();

  return { usuarios, pedidos };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const started = Date.now();
  const counts = buildSeed({ file: DEFAULT_FILE });
  const mb = (fs.statSync(DEFAULT_FILE).size / 1_048_576).toFixed(1);
  console.log(
    `[seed] ${counts.usuarios} usuarios · ${counts.pedidos} pedidos · ${mb} MB · ${Date.now() - started} ms`,
  );
}

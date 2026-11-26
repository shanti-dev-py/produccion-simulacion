import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const PAGE_SIZE = 25;
const MAX_LIMIT = 200;

function clampInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function openDb({ file, seed }) {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  function restoreFromSeed() {
    for (const leftover of [file, `${file}-wal`, `${file}-shm`]) {
      if (fs.existsSync(leftover)) fs.rmSync(leftover);
    }
    fs.copyFileSync(seed, file);
  }

  function connect(handle) {
    handle.pragma('journal_mode = WAL');
    handle.pragma('foreign_keys = ON');
    return {
      listUsuarios: handle.prepare(
        'SELECT id, nombre, email, ciudad, creado_en FROM usuarios ORDER BY id LIMIT ? OFFSET ?',
      ),
      countUsuarios: handle.prepare('SELECT COUNT(*) AS c FROM usuarios'),
      listPedidos: handle.prepare(
        'SELECT id, usuario_id, total, estado, creado_en FROM pedidos ORDER BY id LIMIT ? OFFSET ?',
      ),
      listPedidosDeUsuario: handle.prepare(
        'SELECT id, usuario_id, total, estado, creado_en FROM pedidos WHERE usuario_id = ? ORDER BY id LIMIT ? OFFSET ?',
      ),
      countPedidos: handle.prepare('SELECT COUNT(*) AS c FROM pedidos'),
      countPedidosDeUsuario: handle.prepare('SELECT COUNT(*) AS c FROM pedidos WHERE usuario_id = ?'),
      wipe: handle.transaction(() => {
        handle.prepare('DELETE FROM pedidos').run();
        handle.prepare('DELETE FROM usuarios').run();
      }),
    };
  }

  if (!fs.existsSync(file)) restoreFromSeed();

  let db = new Database(file);
  let stmts = connect(db);

  function usuarios({ page, limit } = {}) {
    const currentPage = clampInt(page, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = clampInt(limit, PAGE_SIZE, MAX_LIMIT);
    return {
      page: currentPage,
      limit: pageSize,
      total: stmts.countUsuarios.get().c,
      rows: stmts.listUsuarios.all(pageSize, (currentPage - 1) * pageSize),
    };
  }

  function pedidos({ page, limit, usuarioId } = {}) {
    const currentPage = clampInt(page, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = clampInt(limit, PAGE_SIZE, MAX_LIMIT);
    const offset = (currentPage - 1) * pageSize;
    const byUser = Number.parseInt(usuarioId, 10);

    if (Number.isFinite(byUser)) {
      return {
        page: currentPage,
        limit: pageSize,
        total: stmts.countPedidosDeUsuario.get(byUser).c,
        rows: stmts.listPedidosDeUsuario.all(byUser, pageSize, offset),
      };
    }

    return {
      page: currentPage,
      limit: pageSize,
      total: stmts.countPedidos.get().c,
      rows: stmts.listPedidos.all(pageSize, offset),
    };
  }

  function counts() {
    return { usuarios: stmts.countUsuarios.get().c, pedidos: stmts.countPedidos.get().c };
  }

  function deleteUsuarios() {
    stmts.wipe();
    return counts();
  }

  function reset() {
    db.close();
    restoreFromSeed();
    db = new Database(file);
    stmts = connect(db);
    return counts();
  }

  return {
    usuarios,
    pedidos,
    counts,
    deleteUsuarios,
    reset,
    close: () => db.close(),
    get path() {
      return file;
    },
  };
}

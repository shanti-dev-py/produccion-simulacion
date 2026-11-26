import Database from 'better-sqlite3';

process.once('message', ({ file, sql, maxRows }) => {
  const db = new Database(file);
  let payload;

  try {
    const statement = db.prepare(sql);

    if (statement.reader) {
      const rows = [];
      for (const row of statement.iterate()) {
        if (rows.length >= maxRows) break;
        rows.push(row);
      }
      payload = { ok: true, filas: rows.length, rows };
    } else {
      const info = statement.run();
      payload = { ok: true, filas: info.changes, rows: [] };
    }
  } catch (error) {
    payload = { ok: false, filas: 0, rows: [], error: error.message };
  } finally {
    db.close();
  }

  process.send(payload, () => process.exit(0));
});

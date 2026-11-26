function tablasDe(sql) {
  const found = new Set();
  const sinLiterales = sql.replace(/'(?:[^']|'')*'/g, "''");

  const desde = /\bfrom\b([\s\S]*?)(?=\bwhere\b|\bgroup\b|\border\b|\blimit\b|;|$)/gi;
  for (const match of sinLiterales.matchAll(desde)) {
    for (const parte of match[1].split(',')) {
      const identificador = parte.trim().match(/^([a-z_][a-z0-9_]*)/i);
      if (identificador) found.add(identificador[1].toLowerCase());
    }
  }

  for (const match of sinLiterales.matchAll(/\bjoin\s+([a-z_][a-z0-9_]*)/gi)) {
    found.add(match[1].toLowerCase());
  }

  return [...found];
}

export function estimar(sql, counts = {}) {
  const tablas = tablasDe(String(sql ?? ''));
  const conocidas = tablas
    .map((tabla) => counts[tabla])
    .filter((total) => Number.isFinite(total));
  const conCondicion = /\b(where|on)\b/i.test(sql);

  if (tablas.length === 0) {
    return { tablas, producto: false, filas: null, motivo: 'no se reconoce la fuente' };
  }

  if (tablas.length > 1 && !conCondicion) {
    const filas = conocidas.reduce((total, actual) => total * actual, 1);
    return {
      tablas,
      producto: true,
      filas,
      motivo: `producto cartesiano: ${tablas.join(' × ')}`,
    };
  }

  if (conocidas.length === 0) {
    return { tablas, producto: false, filas: null, motivo: 'tabla sin conteo conocido' };
  }

  return {
    tablas,
    producto: false,
    filas: Math.max(...conocidas),
    motivo: tablas.length > 1 ? 'JOIN con condición' : 'lectura de una tabla',
  };
}

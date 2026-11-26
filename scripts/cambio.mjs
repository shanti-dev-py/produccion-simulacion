import fs from 'node:fs';

// Precheck barato para la automatización de Orca: sale 0 solo si el estado
// cambió desde la última corrida, y así el bot solo despierta cuando hay algo
// que contar. Sin modelo, sin gastar un turno por minuto.

const BASE = process.env.AURORA_URL ?? 'http://localhost:4000';
const MARCA = process.env.AURORA_CAMBIO ?? '/tmp/aurora-cambio.json';

try {
  const respuesta = await fetch(`${BASE}/api/estado`, { signal: AbortSignal.timeout(2000) });
  if (!respuesta.ok) process.exit(1);

  const estado = (await respuesta.json()).estado;

  let anterior = null;
  try {
    anterior = JSON.parse(fs.readFileSync(MARCA, 'utf8')).estado;
  } catch {
    anterior = null;
  }

  fs.writeFileSync(MARCA, JSON.stringify({ estado, ts: new Date().toISOString() }));

  if (anterior === null) process.exit(1);
  process.exit(anterior === estado ? 1 : 0);
} catch {
  process.exit(1);
}

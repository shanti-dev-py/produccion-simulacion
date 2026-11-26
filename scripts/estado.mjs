import fs from 'node:fs';

// Una línea lista para publicar. Sin URL, sin puerto, sin "local": eso es
// plomería interna y no se dice en un aviso de producción.

const BASE = process.env.AURORA_URL ?? 'http://localhost:4000';
const numero = (valor) => Number(valor ?? 0).toLocaleString('es-CO');

async function consultar() {
  try {
    const respuesta = await fetch(`${BASE}/api/estado`, { signal: AbortSignal.timeout(2500) });
    if (!respuesta.ok) return null;
    return await respuesta.json();
  } catch {
    return null;
  }
}

const estado = await consultar();

if (!estado) {
  console.log('producción sin respuesta · la API no contesta');
  process.exit(0);
}

const detalles = `${numero(estado.filas)} filas · disponibilidad ${estado.disponibilidad} % · error ${estado.errorRate} %`;

if (estado.estado === 'caida') {
  console.log(`producción caída · ${detalles} · el reporte sigue corriendo sin JOIN`);
} else if (estado.estado === 'vacia') {
  console.log(`producción vacía · ${detalles} · se borraron los usuarios`);
} else {
  console.log(`producción operativa · ${detalles}`);
}

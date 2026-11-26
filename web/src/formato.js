export const numero = (valor) => Number(valor).toLocaleString('es-CO');

export const hora = (iso) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour12: false });

export const horaExacta = (iso) => {
  const fecha = new Date(iso);
  const dos = (valor) => String(valor).padStart(2, '0');
  return `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
};

async function json(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

const post = (url, body) =>
  json(url, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

export const api = {
  estado: (since = 0) => json(`/api/estado?since=${since}`),
  usuarios: (page, limit = 25) => json(`/api/usuarios?page=${page}&limit=${limit}`),
  pedidos: (page, limit = 25, usuarioId) =>
    json(`/api/pedidos?page=${page}&limit=${limit}${usuarioId ? `&usuario_id=${usuarioId}` : ''}`),
  consulta: (sql) => post('/api/consulta', { sql }),
  accion: {
    sebas: () => post('/api/reportes/cartesiano'),
    join: () => post('/api/reportes/join'),
    delete: () => json('/api/usuarios', { method: 'DELETE' }),
    reiniciar: () => post('/api/incidente/reiniciar'),
    reset: () => post('/api/incidente/reset'),
  },
};

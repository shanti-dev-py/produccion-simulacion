import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { getAbsoluteFSPath } from 'swagger-ui-dist';
import { estimar } from './planner.js';
import { ejecutar } from './consulta.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', 'web', 'dist');

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Aurora API</title>
  <link rel="stylesheet" href="/docs-assets/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/docs-assets/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/openapi.yaml', dom_id: '#swagger-ui', docExpansion: 'list' });
  </script>
</body>
</html>`;

export function createApp({ machine, reportes, db, log }) {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Express 4 no captura promesas rechazadas: sin esto, un fallo en una ruta
  // asíncrona tumba el proceso en medio de una toma.
  const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // Con el worker saturando la base, lo que toca datos se arrastra. Es real
  // para el endpoint del reporte y degradación explícita para el resto.
  const baseSaturada = asyncHandler(async (req, res, next) => {
    if (machine.snapshot().estado === 'caida') {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()) });
  });

  app.get('/api/estado', baseSaturada, (req, res) => {
    const since = Number.parseInt(req.query.since, 10) || 0;
    res.json({
      ...machine.snapshot(),
      reporte: reportes.estado(),
      counts: db.counts(),
      logs: log.lines(since),
      seq: log.seq,
      generacion: log.generacion,
    });
  });

  app.get('/api/logs', (req, res) => {
    const since = Number.parseInt(req.query.since, 10) || 0;
    res.json({ seq: log.seq, lines: log.lines(since) });
  });

  app.get('/api/usuarios', baseSaturada, (req, res) => {
    res.json(db.usuarios({ page: req.query.page, limit: req.query.limit }));
  });

  app.get('/api/pedidos', baseSaturada, (req, res) => {
    res.json(db.pedidos({ page: req.query.page, limit: req.query.limit, usuarioId: req.query.usuario_id }));
  });

  app.get('/api/reportes', (req, res) => {
    res.json({ estado: machine.snapshot().estado, ...reportes.estado() });
  });

  app.post('/api/reportes/cartesiano', asyncHandler(async (req, res) => {
    res.json(await machine.apply('sebas'));
  }));

  app.post('/api/reportes/join', asyncHandler(async (req, res) => {
    res.json(await machine.apply('join'));
  }));

  app.post('/api/consulta', asyncHandler(async (req, res) => {
    const sql = String(req.body?.sql ?? '');
    const plan = estimar(sql, db.counts());
    const resultado = await ejecutar(sql, { file: db.path });
    res.json({ sql, plan, ...resultado });
  }));

  app.delete('/api/usuarios', asyncHandler(async (req, res) => {
    res.json(await machine.apply('delete'));
  }));

  app.post('/api/incidente/reiniciar', asyncHandler(async (req, res) => {
    res.json(await machine.apply('reiniciar'));
  }));

  app.post('/api/incidente/reset', asyncHandler(async (req, res) => {
    res.json(await machine.apply('reset'));
  }));

  app.use('/docs-assets', express.static(getAbsoluteFSPath()));
  app.get('/docs', (req, res) => res.type('html').send(SWAGGER_HTML));
  app.get('/openapi.yaml', (req, res) => res.sendFile(path.join(HERE, 'openapi.yaml')));

  app.use(express.static(DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST, 'index.html'), (error) => {
      if (error) res.status(404).send('Panel sin compilar. Ejecutá: npm run build');
    });
  });

  app.use((error, req, res, next) => {
    log.error(`error en ${req.method} ${req.path} · ${error.message}`);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'error interno' });
  });

  return app;
}

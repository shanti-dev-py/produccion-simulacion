# Producción simulada — plan de implementación

> **Para agentes:** usar `executing-plans` (ejecución nativa) o
> `subagent-driven-development`. Los pasos son checkboxes.

**Objetivo:** un panel de operaciones ("Aurora") que se rompe de verdad y se
recupera, para grabar el sketch *¡Se cayó producción!*.

**Arquitectura:** Express sirve API, Swagger y el build de React desde un solo
puerto. SQLite local con 5.000 usuarios y 400.000 pedidos. La caída es un
`worker_thread` que satura la base hasta que el `JOIN` lo mata. Una máquina de
estados alimenta la UI, la terminal y el REPL.

**Stack:** Node 20, Express, better-sqlite3, React + Vite (JSX), Swagger UI.
Tests con `node:test`. Sin servicios externos.

**Spec:** `docs/superpowers/specs/2026-11-26-produccion-simulacion-design.md`

## Restricciones globales

- Un proceso, un puerto (`3000`). Sin CORS, sin SSE.
- Texto en pantalla y logs en español; identificadores en inglés.
- Sin internet en tiempo de ejecución: fuentes e iconos empaquetados.
- Nada cambia por tiempo: cada evento deja un estado reproducible.
- Commits convencionales, sin atribución a IA.

## Focos de revisión

1. **Reset con el worker vivo** — `reset` debe matar el worker antes de copiar
   `seed.db`; si no, el archivo queda bloqueado y la toma se cae.
2. **SQL con varias sentencias** (`SELECT 1; DROP TABLE usuarios`) — debe
   rechazarse entero, no ejecutar la primera.
3. **Consulta que escribe** (`UPDATE`, `INSERT`, `DELETE`) desde la consola —
   se permite solo lo que el guion necesita; el plan debe dejarlo explícito.
4. **Paginación fuera de rango** (`page=999`) — respuesta vacía con total
   correcto, no error 500.
5. **Estado `vacia`** — ningún endpoint debe romperse cuando las tablas están
   vacías.

---

### Tarea 1: Scaffold y semilla determinista

**Archivos:**
- Crear: `package.json`, `.gitignore`, `server/seed.js`, `test/seed.test.js`

**Interfaces:**
- Produce: `buildSeed({ file }) → { usuarios: 5000, pedidos: 400000 }`
- Produce: `data/seed.db` generado con PRNG `mulberry32(20261126)`.

- [ ] Test: `buildSeed` sobre archivo temporal devuelve los dos conteos y el
      `id` 1 de `usuarios` es idéntico en dos corridas.
- [ ] Correr `node --test test/seed.test.js` → falla por módulo inexistente.
- [ ] Implementar `server/seed.js` con `better-sqlite3`, `PRAGMA
      journal_mode=WAL`, inserción en una transacción y `usuarios.email`
      derivado del índice. Agregar script `npm run seed`.
- [ ] Correr el test → pasa. Correr `npm run seed` → `data/seed.db` existe.
- [ ] Commit: `chore: scaffold project and deterministic seed`.

---

### Tarea 2: Logger y máquina de estados

**Archivos:**
- Crear: `server/log.js`, `server/machine.js`, `test/log.test.js`,
  `test/machine.test.js`

**Interfaces:**
- `createLog({ sink }) → { info, warn, error, ok, fatal, lines(since), seq }`
  — línea `{ seq, ts, level, msg, sql? }`; `sink` por defecto `process.stdout`.
- `createMachine({ log, deps }) → { apply(event), snapshot(), on(event, fn) }`
  — eventos `sebas | join | delete | reiniciar | reset`;
  `snapshot() → { estado, disponibilidad, errorRate, filas, desde }`.

- [ ] Test: `createMachine` arranca en `operativa` con `disponibilidad
      99.99`; `apply('sebas')` deja `caida` y `filas 2000000000`; `apply('join')`
      vuelve a `operativa` con `filas 400000`; `apply('delete')` deja `vacia`.
- [ ] Correr los tests → fallan.
- [ ] Implementar ambos módulos. `disponibilidad` y `errorRate` salen de una
      tabla por estado, no de cálculo.
- [ ] Correr los tests → pasan.
- [ ] Commit: `feat: add logger and state machine`.

---

### Tarea 3: Lecturas y reset de la base

**Archivos:**
- Crear: `server/db.js`, `test/db.test.js`

**Interfaces:**
- `openDb({ file, seed }) → { usuarios({page,limit}), pedidos({page,limit,usuarioId}),
  counts(), reset(), close() }`
- Respuesta de listado: `{ page, limit, total, rows }`.

- [ ] Test: `page=1&limit=5` devuelve 5 filas y `total 5000`; `page=999`
      devuelve `rows: []` y `total 5000`; `pedidos({usuarioId: 1})` solo
      devuelve ese usuario; `reset()` restaura 5.000 después de un `DELETE`.
- [ ] Correr → falla.
- [ ] Implementar `openDb` con sentencias preparadas y `reset()` que cierra,
      copia `seed` sobre `file` y reabre.
- [ ] Correr → pasa.
- [ ] Commit: `feat: add sqlite access layer with reset`.

---

### Tarea 4: Reportes y el worker que tumba producción

**Archivos:**
- Crear: `server/reportes.js`, `server/reporte-worker.js`,
  `test/reportes.test.js`

**Interfaces:**
- `createReportes({ db, log, machine }) → { cartesiano(), join(), estado(),
  matar() }`
- Worker → mensajes `{ type: 'progreso', filas }` cada 25.000 filas.

- [ ] Test: `cartesiano()` deja la máquina en `caida` y el proceso sigue
      respondiendo (una lectura de `db.counts()` completa en menos de 200 ms
      mientras el worker corre); `join()` mata el worker, deja `operativa` y
      `filas 400000`.
- [ ] Correr → falla.
- [ ] Implementar: el worker abre su propia conexión, recorre el producto
      cartesiano con `LIMIT` incremental y emite progreso; `join()` llama
      `worker.terminate()` y ejecuta el `JOIN` real midiendo milisegundos.
- [ ] Correr → pasa.
- [ ] Commit: `feat: add report engine with saturating worker`.

---

### Tarea 5: Planner y consola SQL

**Archivos:**
- Crear: `server/planner.js`, `server/consulta.js`,
  `test/planner.test.js`, `test/consulta.test.js`

**Interfaces:**
- `estimar(sql, counts) → { tablas, producto, filas, motivo }`
- `ejecutar(sql, { file, timeoutMs }) → Promise<{ ok, filas, ms, error }>`

- [ ] Test planner: `SELECT * FROM usuarios, pedidos` → `producto true`,
      `filas 2000000000`; la misma consulta con `WHERE usuarios.id =
      pedidos.usuario_id` → `producto false`, `filas 400000`; `SELECT * FROM
      usuarios` → `filas 5000`.
- [ ] Test consulta: `PRAGMA table_info(usuarios)` → `ok false` con motivo;
      `SELECT 1; SELECT 2` → rechazada; una consulta pesada corta a los
      `timeoutMs` con `ok false`.
- [ ] Correr → fallan.
- [ ] Implementar ambos módulos. La lista de tablas se obtiene buscando
      identificadores después de `FROM`/`JOIN`; `producto` exige al menos dos.
- [ ] Correr → pasan.
- [ ] Commit: `feat: add sql planner and timed query console`.

---

### Tarea 6: HTTP, Swagger y REPL

**Archivos:**
- Crear: `server/index.js`, `server/openapi.yaml`, `test/api.test.js`

**Interfaces:**
- `createApp({ machine, db, reportes, log }) → express.Application`
- Todas las rutas del spec. `GET /docs` sirve Swagger UI.

- [ ] Test: `GET /api/estado` en `operativa` devuelve `disponibilidad 99.99`
      y `logs` con `seq`; `POST /api/reportes/cartesiano` deja `caida`;
      `POST /api/reportes/join` deja `operativa`; `DELETE /api/usuarios` deja
      `vacia` y `GET /api/usuarios` responde `total 0` sin error.
- [ ] Correr → falla.
- [ ] Implementar `createApp`, `openapi.yaml` con los esquemas y el REPL con
      `readline` (`estado`, `sebas`, `join`, `delete`, `reiniciar`, `reset`,
      `ayuda`, `clear`).
- [ ] Correr → pasa. Abrir `/docs` y verificar que lista las 13 rutas.
- [ ] Commit: `feat: expose api, swagger docs and console repl`.

---

### Tarea 7: Interfaz Aurora

**Archivos:**
- Crear: `web/index.html`, `web/vite.config.js`, `web/src/main.jsx`,
  `web/src/App.jsx`, `web/src/styles.css`, `web/src/api.js`,
  `web/src/components/{Shell,Sidebar,StatusBand,LogStrip,Usuarios,Pedidos,
  Reportes,Consulta,Incidente}.jsx`

**Interfaces:**
- Consume `GET /api/estado` cada 500 ms y `GET /api/logs?since=`.
- Atajos `1` a `5` y `R` (modo director, activo con `?director=1`).

- [ ] Sin test unitario: la verificación es visual y de teclado.
- [ ] Implementar shell oscuro (sidebar mismo fondo + hairline), banda de
      estado con números tabulares, tabla densa 36 px, consola SQL con
      `Cmd+Enter` y grilla de resultados, franja de logs fija de 220 px.
- [ ] Verificar: build de Vite servido por Express en un solo puerto; recarga
      de estado sin parpadeo; atajos cambian de sección.
- [ ] Commit: `feat: build aurora operations panel`.

---

### Tarea 8: Ensayo y guion técnico

**Archivos:**
- Crear: `README.md`, `docs/rodaje.md`

- [ ] Escribir `docs/rodaje.md` con la secuencia exacta: arranque, Escena 1,
      `sebas`, Escena 3–4, `join`, Escena 5, `delete`, reset entre tomas.
- [ ] Correr la secuencia completa tres veces seguidas y confirmar que la
      tercera toma es idéntica a la primera (`GET /api/estado` con los mismos
      valores).
- [ ] Commit: `docs: add shooting script and repeatability check`.

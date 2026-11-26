# Producción simulada — diseño

## Intención

Utilería de rodaje para el sketch *¡Se cayó producción!*. No es una demo para el
público: es el sistema que los actores operan frente a cámara en un video
pregrabado. Se graba de dos formas —cámara apuntando a la laptop y captura de
pantalla— así que todo el texto debe leerse a 1080p y el conjunto debe parecer
un producto real de operaciones, no una maqueta.

El sistema es un personaje más: se ve sano, se rompe de verdad y se recupera
cuando el Senior dicta el `JOIN`.

## Objetivos

- Panel "Aurora" creíble: estado, usuarios, pedidos, reportes y consola SQL.
- Endpoints reales para cada cosa, documentados en Swagger (`/docs`).
- Terminal que narra en vivo y que es la misma verdad que la web.
- La caída es real: un worker satura SQLite; no hay animación de "modo rojo".
- Reset instantáneo entre tomas.
- Tres formas de disparar la misma máquina de estados: botones, teclas, REPL.

## No objetivos

- Autenticación, multiusuario, despliegue remoto, métricas históricas.
- Postgres o cualquier servicio externo: un proceso, un puerto, sin red.
- Diseñar la escenografía ni el guion: el sketch ya existe.

## Restricciones

- Node 20, un solo proceso, un solo puerto. Express sirve el build de React, la
  API y Swagger.
- SQLite local (`better-sqlite3`), sin servidor de base de datos.
- Funciona sin internet: fuentes e iconos empaquetados.
- Texto de pantalla y logs en español (van en cuadro). Código e identificadores
  en inglés.

## Arquitectura

```
server/
  index.js            arranque HTTP + REPL + estáticos
  log.js              logger: stdout con ANSI + buffer en memoria
  machine.js          estados y eventos (única fuente de verdad)
  db.js               conexión, lecturas paginadas, reset desde seed.db
  seed.js             genera data/seed.db de forma determinista
  planner.js          estimación de filas (producto cartesiano)
  consulta.js         ejecución de SQL del usuario (worker + timeout)
  reporte-worker.js   consulta mala: satura la base hasta que la maten
  openapi.yaml        contrato
web/
  src/…               React + Vite, JSX
data/
  seed.db             semilla inmutable
  data.db             copia de trabajo
```

### Estados

| Estado | Significado | Disponibilidad | Origen |
|---|---|---|---|
| `operativa` | todo sano | 99.99 % | arranque, `join`, `reset` |
| `caida` | worker cartesiano saturando | 41.20 % | `sebas` |
| `vacia` | usuarios borrados | 0.00 % | `delete` |

El estado vive en `machine.js`; endpoints, teclas y REPL llaman a la misma
función `apply(event)`. Nada cambia por tiempo: cada evento deja una foto
reproducible, para que la toma 7 salga igual que la 1.

### La caída

`POST /api/reportes/cartesiano` levanta un `worker_thread` con su propia
conexión a SQLite que ejecuta `SELECT * FROM usuarios, pedidos` y reporta
progreso. El hilo principal queda libre: `/api/estado` sigue respondiendo y la
pantalla se pone roja en vivo mientras la base está de verdad saturada.

El worker no muere solo. `join` lo termina y ejecuta la consulta correcta, que
devuelve 400.000 filas en milisegundos. Ese contraste es el remate de la escena.

### Datos

5.000 usuarios y 400.000 pedidos, generados con PRNG determinista (semilla
fija): dos corridas producen el mismo archivo. `seed.db` nunca se toca; el
reset copia `seed.db` sobre `data.db`.

### Métricas

- latencia: medida de las peticiones reales (ventana de 60 s).
- filas del último reporte.
- retraso del event loop (`perf_hooks.monitorEventLoopDelay`), real.
- disponibilidad y tasa de error: derivadas del estado, para que la Escena 1
  diga exactamente 99.99 % y el sketch calce con el guion.

## API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/health` | vivo/muerto |
| GET | `/api/estado` | estado, métricas y últimas líneas de log |
| GET | `/api/logs?since=` | líneas nuevas desde un `seq` |
| GET | `/api/usuarios?page&limit` | listado paginado |
| GET | `/api/pedidos?page&limit&usuario_id` | listado paginado |
| GET | `/api/reportes` | historial de reportes de la sesión |
| POST | `/api/reportes/cartesiano` | dispara la caída |
| POST | `/api/reportes/join` | mata el worker y recupera |
| POST | `/api/consulta` | plan + ejecución de SQL libre |
| DELETE | `/api/usuarios` | el chiste final: conjunto vacío |
| POST | `/api/incidente/reiniciar` | no hace nada, y lo dice |
| POST | `/api/incidente/reset` | restaura `data.db` desde `seed.db` |

`GET /api/estado` es el único que la UI consulta en bucle (cada 500 ms). Sin
SSE ni WebSocket: menos piezas que se rompan en el rodaje.

## Consola SQL

`POST /api/consulta` recibe `{ sql }` y responde plan + filas.

- Una sola sentencia. Se rechazan `PRAGMA`, `ATTACH`, `DETACH`, `VACUUM`.
- Si hay más de una tabla en `FROM`/`JOIN` y no hay `ON` ni `WHERE`, el plan
  estima `filas × filas` y lo marca como producto cartesiano.
- Ejecución en worker con corte a 4.000 ms y 200 filas de salida.
- `DELETE` está permitido a propósito: es el gag del final.

## Terminal

El logger escribe a `stdout` con color y guarda las mismas líneas en un buffer
con `seq`. La franja de logs de la web pide `/api/logs?since=` y muestra
exactamente lo mismo. Un close-up al terminal y un plano de la pantalla
coinciden.

REPL del servidor: `estado`, `sebas`, `join`, `delete`, `reiniciar`, `reset`,
`ayuda`, `clear`. Permite grabar una toma completa sin tocar el mouse.

## Dirección visual

**Dominio.** Sala de operaciones de madrugada: tablero de incidentes, cinta de
logs, luces de estado, café frío. Vocabulario: turno, incidente, severidad,
umbral, traza, saturación.

**Mundo de color.** El negro azulado del monitor, el verde fósforo del "OK", el
ámbar de la alerta, el rojo del corte, el gris del cableado.

**Firma.** El contador de filas trepando hacia 2.000.000.000 junto al pulso del
estado. Es lo único que este producto tiene y ningún otro panel tendría.

**Defaults rechazados.**

1. Sidebar de otro color + cards con sombra → mismo fondo que el lienzo, borde
   hairline, profundidad solo por borde.
2. Fila de "metric cards" con ícono a la izquierda → una sola banda de
   instrumentación con números tabulares alineados y etiquetas en versalitas.
3. Tabla con cebreado y badges redondeados → tabla densa de 36 px, hairlines,
   IDs y montos en monoespaciada.
4. Toast de confirmación → la franja de logs es el único canal de feedback.

**Tokens.** Fondo `#0A0F14`; superficies `#0F161D`, `#151E27`; línea
`rgba(255,255,255,.07)`; texto `#E6EDF3` / `#AEBAC6` / `#6B7C8C`; señal
`#3FB950`; alarma `#D29922`; corte `#F85149`; datos `#58A6FF`. Sin gradientes,
sin sombras. Radio 6/8/10. Base 4 px.

**Tipografía.** IBM Plex Mono para datos, SQL, logs y métricas; Inter para la
interfaz. Ambas empaquetadas con `@fontsource` para grabar sin internet.

**Tema oscuro** por cámara: el blanco pleno revienta el sensor y el moiré se
come los grises claros.

## Riesgos

- `better-sqlite3` requiere binario nativo: verificado en este equipo con Node
  20 (prebuild disponible).
- 400.000 filas hacen que `SELECT * FROM usuarios, pedidos` sea inejecutable de
  verdad: por eso el worker reporta progreso y se corta por decisión, no por
  completitud.
- La cámara puede perder detalle fino: nada esencial por debajo de 12 px.

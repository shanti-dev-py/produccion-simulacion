# Aurora — producción simulada

Panel de operaciones para el rodaje del sketch *¡Se cayó producción!*. Es el
sistema que los actores operan frente a cámara: arranca sano, se rompe de
verdad y se recupera cuando aplican el `JOIN`.

- Un solo proceso, un solo puerto: Express sirve la API, Swagger y el panel.
- SQLite local con **5.000 usuarios** y **400.000 pedidos** reales.
- La caída no es una animación: un `worker_thread` satura la base mientras el
  hilo principal sigue respondiendo, y el panel se pone rojo en vivo.
- La terminal narra lo mismo que se ve en pantalla, con los mismos números.

## Requisitos

- Node 20 o superior (`better-sqlite3` compila nativo al instalar).
- Sin internet en tiempo de ejecución: las fuentes van empaquetadas.

Si `better-sqlite3` falla con `NODE_MODULE_VERSION`, el binario se compiló con
otro Node. Recompilalo con el mismo que vas a usar:

```bash
npm rebuild better-sqlite3
```

## Puesta en marcha

```bash
npm install
npm run seed     # genera data/seed.db (una sola vez, ~38 MB)
npm run dev      # compila el panel y levanta el servidor
```

Queda disponible en **http://localhost:4000**. La semilla también se genera
sola en el primer arranque si falta.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Compila React y arranca todo |
| `npm start` | Arranca sin recompilar (requiere `web/dist`) |
| `npm run seed` | Regenera `data/seed.db` desde cero |
| `npm test` | Suite completa (`node:test`) |

`PORT=4100 npm start` cambia el puerto.

## El sistema

| Sección | Qué muestra |
|---|---|
| Estado | semáforo, disponibilidad, error, latencia, filas y acciones de incidente |
| Usuarios | 5.000 usuarios paginados |
| Pedidos | 400.000 pedidos, filtrables por usuario |
| Reportes | la consulta de Sebas contra la consulta correcta |
| Consulta SQL | editor libre con plan estimado y resultado |

Abajo, siempre visible, la franja **SERVER LOG**: es el mismo flujo que imprime
la terminal, línea por línea.

`/docs` sirve Swagger UI con las trece rutas del contrato.

## Guion de la caída

| Momento | Acción | Resultado |
|---|---|---|
| Escena 1 | nada | `operativa`, 99.99 %, 400.000 filas |
| Escena 2 | «Ejecutar reporte de Sebas» | `caida`, 2.000.000.000 filas, todo rojo |
| Escenas 3–4 | — | el reporte sigue corriendo; el log acumula filas |
| Escena 5 | «Aplicar JOIN» | `operativa`, 400.000 filas en ~30 ms |
| Final | «DELETE FROM usuarios» | `vacia`, usuarios = ∅ |

«Reiniciar» existe para el chiste de Camilo: responde, escribe en el log y no
cambia absolutamente nada.

## Manejo desde la terminal

El servidor abre un REPL (`aurora>`) cuando corre en una terminal interactiva:

```
estado     resumen del sistema
sebas      dispara el reporte cartesiano
join       mata el worker y recupera
delete     borra usuarios y pedidos
reiniciar  no hace nada, y lo dice
reset      restaura la base desde la semilla
ayuda      lista de comandos
clear      limpia la pantalla
```

También se puede manejar con la URL: `/#consulta`, `/#reportes`, etc. Y con
`?director=1` se activan los atajos `1`–`5` para cambiar de sección y `R` para
resetear entre tomas.

## Cómo se simula

- `server/reporte-worker.js` ejecuta el producto cartesiano real con `LIMIT`
  creciente sobre su propia conexión, y reporta el avance. No termina nunca:
  muere cuando el `JOIN` lo mata.
- `server/consulta.js` ejecuta SQL libre en un proceso aparte. Se usa un
  proceso y no un worker porque `terminate()` no puede interrumpir una llamada
  nativa bloqueante; `SIGKILL` sí.
- `server/db.js` guarda `seed.db` inmutable y trabaja sobre `data.db`. El reset
  copia la semilla: cada toma arranca con los mismos 5.000 y 400.000.

## Estructura

```
server/   api, máquina de estados, motor de reportes, semilla
web/      panel React (JSX) con Vite
data/     seed.db y data.db (ignorados por git)
test/     suite de node:test
docs/     diseño, plan y guion de rodaje
```

## Limitaciones a propósito

- Sin autenticación, sin multiusuario, sin métricas históricas.
- Los números de disponibilidad y tasa de error son parte del guion; las filas,
  la latencia y el bloqueo del worker son reales.

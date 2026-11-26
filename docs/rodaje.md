# Guion de rodaje

Todo lo que hay que hacer antes, durante y entre tomas. La cámara filma la
laptop y además se captura la pantalla; los dos planos muestran lo mismo.

## Antes de rodar (una sola vez)

```bash
npm install
npm run seed
npm run dev
```

- Abrir `http://localhost:4000/?director=1#estado` en el navegador de la laptop.
- Pantalla completa (`F11`), zoom del navegador en 100 %.
- Cerrar notificaciones del sistema. El sketch ya tiene suficientes alarmas.
- Dejar la terminal del servidor a la vista en una pestaña o ventana aparte:
  el plano del terminal es parte de la escena.

## Antes de cada toma

1. `R` (o `reset` en la terminal) hasta ver **operativa · 99.99 %**.
2. Confirmar que la franja de log no tenga líneas rojas: si quedan, es que el
   reset no terminó.
3. Poner la sección `Estado` con la tecla `1`.
4. Notificaciones del escritorio activas (no «No molestar»): el aviso de
   «¡Se cayó producción!» aparece en pantalla en el instante del click y sirve
   de plano.
5. **Modo guía apagado** (interruptor abajo a la izquierda, tecla `G` en modo
   director). Encendido muestra las explicaciones del sketch; apagado deja solo
   el producto. Para grabar, apagado.

## Escena por escena

| Escena | Quién | Acción | Qué se ve |
|---|---|---|---|
| 1 | Juan | — | verde, 99.99 %, 400.000 filas, cero alertas |
| 2 | Juan / Sebas | «Ejecutar reporte de Sebas» | rojo, 2.000.000.000, disponibilidad 41.20 % |
| 3 | Sebas | — | el reporte sigue corriendo; el contador de filas sube |
| 4 | Senior | `5` → Consola SQL → `ctrl + enter` | el plan estima 2.000.000.000 y avisa del producto cartesiano |
| 5 | Sebas | «Aplicar JOIN» | verde, 400.000 filas en ~30 ms |
| Final | Sebas | «DELETE FROM usuarios» | rojo, usuarios = ∅ |

El plano del terminal para la Escena 4 se graba después de lanzar la consulta:
las líneas `WARN` y `ERROR` ya están en pantalla.

## Entre tomas

- `R` restaura la base desde la semilla en menos de un segundo.
- Si el worker quedó vivo, `reset` lo mata antes de copiar.
- No hace falta reiniciar el servidor entre tomas.

## Qué no hacer

- No apretar «Restaurar semilla» en medio de una toma: vuelve todo a verde de
  golpe y arruina la Escena 2.
- No recargar el navegador con la caída en curso: el panel vuelve a pedir el
  estado y aparece rojo igual, pero el log arranca vacío.
- No cerrar la terminal: ahí vive el proceso.

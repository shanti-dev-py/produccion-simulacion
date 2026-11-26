import { useState } from 'react';
import { api } from '../api.js';
import { numero } from '../formato.js';

const SQL_INICIAL = 'SELECT * FROM usuarios, pedidos;';

function columnasDe(filas) {
  if (!filas?.length) return [];
  return Object.keys(filas[0]);
}

export function Consulta() {
  const [sql, setSql] = useState(SQL_INICIAL);
  const [resultado, setResultado] = useState(null);
  const [corriendo, setCorriendo] = useState(false);

  async function ejecutar() {
    setCorriendo(true);
    try {
      setResultado(await api.consulta(sql));
    } catch (error) {
      setResultado({ ok: false, error: error.message, rows: [], filas: 0, ms: 0 });
    } finally {
      setCorriendo(false);
    }
  }

  function onKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      ejecutar();
    }
  }

  const columnas = columnasDe(resultado?.rows);

  return (
    <section className="seccion">
      <header className="seccion__cabecera">
        <div>
          <h1 className="seccion__titulo">Consulta SQL</h1>
          <p className="seccion__bajada">Se ejecuta contra la misma base de producción</p>
        </div>
        <span className="atajo">ctrl + enter</span>
      </header>

      <div className="consola">
        <div className="consola__editor">
          <textarea
            className="editor"
            value={sql}
            spellCheck={false}
            onChange={(event) => setSql(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Consulta SQL"
          />
          <div className="consola__pie">
            <span className="consola__limite">timeout 4.000 ms · máximo 200 filas</span>
            <button type="button" className="boton boton--primario" onClick={ejecutar} disabled={corriendo}>
              {corriendo ? 'Ejecutando…' : 'Ejecutar'}
            </button>
          </div>
        </div>

        <aside className="consola__plan">
          <p className="rotulo">plan estimado</p>
          {resultado ? (
            <>
              <p className={`plan__filas${resultado.plan?.producto ? ' plan__filas--corte' : ''}`}>
                {resultado.plan?.filas === null || resultado.plan?.filas === undefined
                  ? '—'
                  : numero(resultado.plan.filas)}
              </p>
              <p className="plan__motivo">{resultado.plan?.motivo}</p>
              {resultado.plan?.producto && (
                <p className="aviso aviso--error">
                  Producto cartesiano: cada usuario se cruza con cada pedido.
                </p>
              )}
              <p className="plan__meta">
                {resultado.ok ? `${numero(resultado.filas)} filas · ${resultado.ms} ms` : 'sin resultado'}
              </p>
            </>
          ) : (
            <p className="plan__motivo">Escribí una consulta y ejecutala para ver la estimación.</p>
          )}
        </aside>
      </div>

      {resultado && !resultado.ok && <p className="aviso aviso--error">{resultado.error}</p>}

      {resultado?.ok && (
        <div className="tabla__marco">
          <table className="tabla">
            <thead>
              <tr>
                {columnas.map((columna) => (
                  <th key={columna}>{columna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultado.rows.map((fila, indice) => (
                <tr key={indice}>
                  {columnas.map((columna) => (
                    <td key={columna} className="tabla__mono">
                      {String(fila[columna])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {resultado.rows.length === 0 && <p className="vacio">La consulta no devolvió filas.</p>}
        </div>
      )}
    </section>
  );
}

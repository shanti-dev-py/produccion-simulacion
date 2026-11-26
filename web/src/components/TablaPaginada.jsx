import { useEffect, useState } from 'react';
import { numero } from '../formato.js';

export function TablaPaginada({ titulo, cargar, columnas, filtro }) {
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);

    cargar(pagina, 25, filtro)
      .then((respuesta) => {
        if (!vivo) return;
        setDatos(respuesta);
        setError(null);
      })
      .catch((problema) => {
        if (!vivo) return;
        setError(problema.message);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [pagina, cargar, filtro]);

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.limit)) : 1;

  return (
    <section className="seccion">
      <header className="seccion__cabecera">
        <div>
          <h1 className="seccion__titulo">{titulo}</h1>
          <p className="seccion__bajada">
            {datos ? `${numero(datos.total)} registros en total` : 'cargando…'}
          </p>
        </div>
        <div className="paginador">
          <button
            type="button"
            className="boton boton--fantasma boton--compacto"
            onClick={() => setPagina((valor) => Math.max(1, valor - 1))}
            disabled={pagina === 1 || cargando}
          >
            ‹
          </button>
          <span className="paginador__cuenta">
            {pagina} / {numero(totalPaginas)}
          </span>
          <button
            type="button"
            className="boton boton--fantasma boton--compacto"
            onClick={() => setPagina((valor) => Math.min(totalPaginas, valor + 1))}
            disabled={pagina >= totalPaginas || cargando}
          >
            ›
          </button>
        </div>
      </header>

      {error && <p className="aviso aviso--error">No se pudo cargar: {error}</p>}

      <div className="tabla__marco">
        <table className="tabla">
          <thead>
            <tr>
              {columnas.map((columna) => (
                <th
                  key={columna.clave}
                  style={{ width: columna.ancho }}
                  className={columna.alinear === 'right' ? 'tabla__th--derecha' : undefined}
                >
                  {columna.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos?.rows.map((fila) => (
              <tr key={fila.id}>
                {columnas.map((columna) => (
                  <td
                    key={columna.clave}
                    className={[
                      columna.mono ? 'tabla__mono' : '',
                      columna.alinear === 'right' ? 'tabla__td--derecha' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {columna.formato ? columna.formato(fila[columna.clave]) : fila[columna.clave]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {!cargando && datos?.rows.length === 0 && (
          <p className="vacio">Sin registros. El conjunto está vacío.</p>
        )}
        {cargando && !datos && <p className="vacio">cargando…</p>}
      </div>
    </section>
  );
}

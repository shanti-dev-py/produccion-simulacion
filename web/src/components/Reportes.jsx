import { numero } from '../formato.js';

function Dato({ rotulo, valor, tono }) {
  return (
    <div className="dato">
      <dt className="rotulo">{rotulo}</dt>
      <dd className={`dato__valor${tono ? ` dato__valor--${tono}` : ''}`}>{valor}</dd>
    </div>
  );
}

export function Reportes({ estado, ocupado, disparar, guia }) {
  if (!estado) return <p className="vacio">conectando con aurora…</p>;

  const activo = Boolean(estado.reporte?.activo);

  return (
    <section className="seccion">
      <header className="seccion__cabecera">
        <div>
          <h1 className="seccion__titulo">Reportes</h1>
          <p className="seccion__bajada">Usuarios con sus pedidos · 5.000 × 400.000</p>
        </div>
      </header>

      <div className="rejilla rejilla--dos">
        <article className={`panel panel--reporte${activo ? ' panel--vivo' : ''}`}>
          <header className="panel__cabecera">
            <p className="rotulo">reporte de sebas</p>
            {guia && <span className="etiqueta etiqueta--alarma">sin filtro</span>}
          </header>

          <code className="sql sql--bloque">SELECT * FROM usuarios, pedidos;</code>

          <dl className="datos">
            <Dato rotulo="filas estimadas" valor={numero(2_000_000_000)} tono="corte" />
            <Dato rotulo="filas materializadas" valor={numero(estado.reporte?.filas ?? 0)} />
            <Dato rotulo="estado" valor={activo ? 'en curso' : 'detenido'} />
            <Dato rotulo="transcurrido" valor={`${numero(estado.reporte?.ms ?? 0)} ms`} />
          </dl>

          <button
            type="button"
            className="boton boton--alarma boton--ancho"
            disabled={Boolean(ocupado) || activo}
            onClick={() => disparar('sebas')}
          >
            {activo ? 'Ya está corriendo' : 'Ejecutar reporte'}
          </button>
        </article>

        <article className="panel panel--reporte">
          <header className="panel__cabecera">
            <p className="rotulo">reporte corregido</p>
            {guia && <span className="etiqueta etiqueta--senal">con JOIN</span>}
          </header>

          <code className="sql sql--bloque">
            SELECT u.nombre, p.total{'\n'}FROM usuarios u{'\n'}JOIN pedidos p ON u.id = p.usuario_id;
          </code>

          <dl className={`datos${guia ? '' : ' datos--tres'}`}>
            <Dato rotulo="filas" valor={numero(400_000)} tono="senal" />
            {guia && <Dato rotulo="relación" valor="un usuario por pedido" />}
            <Dato rotulo="tiempo típico" valor="≈ 200 ms" />
            <Dato rotulo="estado" valor={estado.estado === 'operativa' ? 'aplicado' : 'pendiente'} />
          </dl>

          <button
            type="button"
            className="boton boton--primario boton--ancho"
            disabled={Boolean(ocupado)}
            onClick={() => disparar('join')}
          >
            Aplicar JOIN
          </button>
        </article>
      </div>

      {guia && (
        <p className="nota-pie">
          Dos mil millones de filas son cinco mil usuarios multiplicados por cuatrocientos mil pedidos.
          El JOIN es la función que asigna a cada pedido un único usuario.
        </p>
      )}
    </section>
  );
}

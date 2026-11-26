import { numero, hora } from '../formato.js';

const TONO = {
  operativa: 'senal',
  caida: 'corte',
  vacia: 'alarma',
};

function Metrica({ rotulo, valor, detalle, tono = 'neutro' }) {
  return (
    <div className={`metrica metrica--${tono}`}>
      <p className="rotulo">{rotulo}</p>
      <p className="metrica__valor">{valor}</p>
      {detalle && <p className="metrica__detalle">{detalle}</p>}
    </div>
  );
}

export function Estado({ estado, latencia, sinRespuesta, ocupado, disparar, irA, guia }) {
  if (!estado) return <p className="vacio">conectando con aurora…</p>;

  const caida = estado.estado === 'caida';
  const vacia = estado.estado === 'vacia';

  return (
    <section className="seccion">
      <header className="seccion__cabecera">
        <div>
          <h1 className="seccion__titulo">Estado</h1>
          <p className="seccion__bajada">
            Última transición {hora(estado.desde)} · {numero(estado.counts.usuarios)} usuarios ·{' '}
            {numero(estado.counts.pedidos)} pedidos
          </p>
        </div>
        <button type="button" className="boton boton--fantasma" onClick={() => irA('reportes')}>
          Ver reportes
        </button>
      </header>

      <div className="instrumental">
        <div className="instrumental__heroe">
          <p className="rotulo">filas del último reporte</p>
          <p className={`cifra cifra--${TONO[estado.estado]}`}>{numero(estado.filas)}</p>
          {guia && (
            <p className="instrumental__nota">
              {caida && 'producto cartesiano · sin ON ni WHERE'}
              {vacia && 'conjunto vacío · usuarios = ∅'}
              {!caida && !vacia && 'cuatrocientos mil pedidos con su usuario'}
            </p>
          )}
        </div>

        <div className="instrumental__metricas">
          <Metrica
            rotulo="disponibilidad"
            valor={`${estado.disponibilidad.toFixed(2)} %`}
            detalle="ventana de 5 min"
            tono={TONO[estado.estado]}
          />
          <Metrica
            rotulo="tasa de error"
            valor={`${estado.errorRate.toFixed(2)} %`}
            detalle="5xx / total"
            tono={estado.errorRate > 1 ? 'corte' : 'neutro'}
          />
          <Metrica
            rotulo="respuesta"
            valor={latencia === null ? '—' : `${latencia} ms`}
            detalle={sinRespuesta ? 'sin respuesta' : 'p50 · api'}
            tono={latencia !== null && latencia > 400 ? 'alarma' : 'neutro'}
          />
        </div>
      </div>

      <div className="servicios">
        <div className="servicio">
          <span className={`servicio__punto servicio__punto--${caida ? 'alarma' : 'senal'}`} />
          <div>
            <p className="servicio__nombre">API</p>
            <p className="servicio__detalle">{caida ? 'respondiendo con demora' : 'respondiendo'}</p>
          </div>
        </div>
        <div className="servicio">
          <span className={`servicio__punto servicio__punto--${vacia ? 'alarma' : caida ? 'corte' : 'senal'}`} />
          <div>
            <p className="servicio__nombre">Base de datos</p>
            <p className="servicio__detalle">
              {vacia ? 'sin usuarios ni pedidos' : caida ? 'saturada por el reporte' : 'lecturas al día'}
            </p>
          </div>
        </div>
        <div className="servicio">
          <span className={`servicio__punto servicio__punto--${estado.reporte?.activo ? 'alarma' : 'senal'}`} />
          <div>
            <p className="servicio__nombre">Cola de reportes</p>
            <p className="servicio__detalle">
              {estado.reporte?.activo ? '1 en curso' : 'sin trabajos'} · {numero(estado.reporte?.filas ?? 0)} filas
            </p>
          </div>
        </div>
      </div>

      {caida && (
        <div className="panel panel--alerta">
          <div>
            <p className="rotulo">consulta en curso</p>
            <code className="sql">{estado.reporte?.activo ? 'SELECT * FROM usuarios, pedidos;' : 'esperando reintento…'}</code>
          </div>
          <div className="panel__derecha">
            <p className="rotulo">filas materializadas</p>
            <p className="panel__cifra">{numero(estado.reporte?.filas ?? 0)}</p>
          </div>
        </div>
      )}

      <div className="acciones">
        <p className="rotulo">acciones de incidente</p>
        <div className="acciones__fila">
          <button
            type="button"
            className="boton boton--alarma"
            disabled={Boolean(ocupado)}
            onClick={() => disparar('sebas')}
          >
            Ejecutar reporte de Sebas
          </button>
          <button
            type="button"
            className="boton boton--primario"
            disabled={Boolean(ocupado)}
            onClick={() => disparar('join')}
          >
            Aplicar JOIN
          </button>
          <button
            type="button"
            className="boton boton--fantasma"
            disabled={Boolean(ocupado)}
            onClick={() => disparar('reiniciar')}
          >
            Reiniciar
          </button>
          <button
            type="button"
            className="boton boton--peligro"
            disabled={Boolean(ocupado)}
            onClick={() => disparar('delete')}
          >
            DELETE FROM usuarios
          </button>
          <button
            type="button"
            className="boton boton--fantasma"
            disabled={Boolean(ocupado)}
            onClick={() => disparar('reset')}
          >
            Restaurar semilla
          </button>
        </div>
        {guia && (
          <p className="acciones__nota">
            «Reiniciar» no hace nada, y lo dice en el log. Es el chiste de Camilo.
          </p>
        )}
      </div>
    </section>
  );
}

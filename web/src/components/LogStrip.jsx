import { useEffect, useRef } from 'react';
import { horaExacta, numero } from '../formato.js';

export function LogStrip({ lines }) {
  const cuerpo = useRef(null);

  useEffect(() => {
    const elemento = cuerpo.current;
    if (elemento) elemento.scrollTop = elemento.scrollHeight;
  }, [lines]);

  return (
    <section className="logs">
      <header className="logs__cabecera">
        <span className="rotulo">server log</span>
        <span className="logs__cuenta">{lines.length} líneas · en vivo</span>
      </header>

      <div className="logs__cuerpo" ref={cuerpo}>
        {lines.map((linea) => (
          <div key={linea.seq} className={`log log--${linea.level}`}>
            <span className="log__hora">{horaExacta(linea.ts)}</span>
            <span className="log__nivel">{linea.level}</span>
            <span className="log__mensaje">
              {linea.msg}
              {linea.sql && <code className="log__sql">SQL {linea.sql}</code>}
            </span>
            <span className="log__seq">{numero(linea.seq)}</span>
          </div>
        ))}
        {lines.length === 0 && <p className="vacio vacio--compacto">esperando eventos…</p>}
      </div>
    </section>
  );
}

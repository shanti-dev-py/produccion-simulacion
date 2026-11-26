import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Estado } from './components/Estado.jsx';
import { Consulta } from './components/Consulta.jsx';
import { Reportes } from './components/Reportes.jsx';
import { TablaPaginada } from './components/TablaPaginada.jsx';
import { LogStrip } from './components/LogStrip.jsx';

const SECCIONES = [
  { id: 'estado', numero: '1', nombre: 'Estado', Componente: Estado },
  { id: 'usuarios', numero: '2', nombre: 'Usuarios', Componente: Usuarios },
  { id: 'pedidos', numero: '3', nombre: 'Pedidos', Componente: Pedidos },
  { id: 'reportes', numero: '4', nombre: 'Reportes', Componente: Reportes },
  { id: 'consulta', numero: '5', nombre: 'Consulta SQL', Componente: Consulta },
];

const COLUMNAS_USUARIOS = [
  { clave: 'id', titulo: 'id', mono: true, ancho: '72px' },
  { clave: 'nombre', titulo: 'nombre' },
  { clave: 'email', titulo: 'email', mono: true },
  { clave: 'ciudad', titulo: 'ciudad' },
  { clave: 'creado_en', titulo: 'alta', mono: true, formato: (valor) => valor.slice(0, 10) },
];

const COLUMNAS_PEDIDOS = [
  { clave: 'id', titulo: 'id', mono: true, ancho: '84px' },
  { clave: 'usuario_id', titulo: 'usuario', mono: true, ancho: '96px' },
  { clave: 'total', titulo: 'total', mono: true, alinear: 'right', formato: (valor) => `$ ${valor.toLocaleString('es-CO')}` },
  { clave: 'estado', titulo: 'estado' },
  { clave: 'creado_en', titulo: 'fecha', mono: true, formato: (valor) => valor.slice(0, 16).replace('T', ' ') },
];

function Usuarios() {
  return <TablaPaginada titulo="Usuarios" cargar={api.usuarios} columnas={COLUMNAS_USUARIOS} />;
}

function Pedidos() {
  return <TablaPaginada titulo="Pedidos" cargar={api.pedidos} columnas={COLUMNAS_PEDIDOS} />;
}

function seccionDesdeHash() {
  const id = window.location.hash.replace('#', '');
  return SECCIONES.some((item) => item.id === id) ? id : 'estado';
}

export default function App() {
  const [estado, setEstado] = useState(null);
  const [logs, setLogs] = useState([]);
  const [seccion, setSeccion] = useState(seccionDesdeHash);
  const [latencia, setLatencia] = useState(null);
  const [sinRespuesta, setSinRespuesta] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const [guia, setGuia] = useState(() => window.localStorage.getItem('aurora.guia') !== '0');

  const seq = useRef(0);
  const fallos = useRef(0);
  const director = new URLSearchParams(window.location.search).get('director') === '1';

  useEffect(() => {
    let vivo = true;
    let timer;

    const tick = async () => {
      const started = performance.now();
      try {
        const data = await api.estado(seq.current);
        if (!vivo) return;
        fallos.current = 0;
        setSinRespuesta(false);
        setLatencia(Math.round(performance.now() - started));
        seq.current = data.seq;
        setEstado(data);
        if (data.logs.length) {
          setLogs((prev) => [...prev, ...data.logs].slice(-400));
        }
      } catch {
        if (!vivo) return;
        fallos.current += 1;
        if (fallos.current >= 2) setSinRespuesta(true);
      } finally {
        if (vivo) timer = setTimeout(tick, 500);
      }
    };

    tick();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, []);

  function alternarGuia() {
    setGuia((valor) => {
      const siguiente = !valor;
      window.localStorage.setItem('aurora.guia', siguiente ? '1' : '0');
      return siguiente;
    });
  }

  function ir(id) {
    setSeccion(id);
    if (window.location.hash !== `#${id}`) window.location.hash = id;
  }

  useEffect(() => {
    const onHash = () => setSeccion(seccionDesdeHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  async function disparar(evento) {
    setOcupado(evento);
    try {
      await api.accion[evento]();
    } catch (error) {
      setSinRespuesta(true);
    } finally {
      setOcupado(null);
    }
  }

  useEffect(() => {
    if (!director) return undefined;

    const onKey = (event) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      const destino = SECCIONES.find((item) => item.numero === event.key);
      if (destino) ir(destino.id);
      if (event.key.toLowerCase() === 'r') disparar('reset');
      if (event.key.toLowerCase() === 'g') alternarGuia();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [director]);

  const actual = SECCIONES.find((item) => item.id === seccion) ?? SECCIONES[0];
  const { Componente } = actual;
  const estadoVisible = sinRespuesta ? 'sin-respuesta' : (estado?.estado ?? 'operativa');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="marca">
          <span className="marca__sigla">AU</span>
          <span className="marca__texto">aurora</span>
        </div>

        <nav className="nav">
          <p className="nav__titulo">operaciones</p>
          {SECCIONES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav__item${item.id === seccion ? ' nav__item--activo' : ''}`}
              onClick={() => ir(item.id)}
            >
              <span className="nav__numero">{item.numero}</span>
              {item.nombre}
            </button>
          ))}
        </nav>

        <div className="sidebar__pie">
          <button
            type="button"
            className={`guia${guia ? ' guia--activa' : ''}`}
            onClick={alternarGuia}
            aria-pressed={guia}
            title="Muestra u oculta las explicaciones de cada pantalla"
          >
            <span className="guia__pista" />
            modo guía
            <span className="guia__valor">{guia ? 'on' : 'off'}</span>
          </button>
          <a href="/docs" target="_blank" rel="noreferrer" className="sidebar__enlace">
            API · Swagger
          </a>
          <p className="sidebar__nota">
            {estado ? `${estado.counts.usuarios.toLocaleString('es-CO')} usuarios · ${estado.counts.pedidos.toLocaleString('es-CO')} pedidos` : 'conectando…'}
          </p>
          <p className="sidebar__nota sidebar__nota--tenue">sesión de juan · turno noche</p>
        </div>
      </aside>

      <header className="topbar">
        <div className="topbar__izquierda">
          <span className="entorno">producción</span>
          <span className="topbar__ruta">/{actual.id}</span>
        </div>
        <div className="topbar__derecha">
          <span className="topbar__latencia">
            latencia <strong>{latencia === null ? '—' : `${latencia} ms`}</strong>
          </span>
          <StatePill estado={estadoVisible} />
        </div>
      </header>

      <main className="main">
        <Componente
          estado={estado}
          latencia={latencia}
          sinRespuesta={sinRespuesta}
          ocupado={ocupado}
          disparar={disparar}
          irA={ir}
          guia={guia}
        />
      </main>

      <LogStrip lines={logs} />
    </div>
  );
}

function StatePill({ estado }) {
  const etiqueta = {
    operativa: 'operativa',
    caida: 'caída',
    vacia: 'vacía',
    'sin-respuesta': 'sin respuesta',
  }[estado] ?? estado;

  return (
    <span className={`pildora pildora--${estado}`}>
      <span className="pildora__punto" />
      {etiqueta}
    </span>
  );
}

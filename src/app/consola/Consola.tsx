"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Datos } from "@/lib/cliente";
import { Auditoria } from "./Auditoria";
import { Comparador } from "./Comparador";
import { Resumen } from "./Resumen";
import { Detalle } from "./Detalle";
import { Equipo } from "./Equipo";
import { Ingreso, type UsuarioSesion } from "./Ingreso";
import { Registros } from "./Registros";
import { Reparto } from "./Reparto";
import { esperaDe } from "./TablaRegistros";
import { campo, Kpi } from "./ui";
import { IconoAuditoria, IconoComparar, IconoEquipo, IconoMarca, IconoRegistros, IconoRepartir, IconoResumen, IconoSalir } from "./iconos";

const TABS = [
  { id: "resumen", nombre: "Resumen", subtitulo: "Qué está pasando hoy y qué necesita revisión" },
  { id: "reparto", nombre: "Repartir", subtitulo: "Elige qué repartir y con qué método; previsualiza antes de guardar" },
  { id: "comparador", nombre: "Comparar métodos", subtitulo: "Los mismos pendientes repartidos con cada método" },
  { id: "registros", nombre: "Registros", subtitulo: "Todas las empresas, a quién se asignaron y por qué" },
  { id: "equipo", nombre: "Equipo comercial", subtitulo: "Cartera, nivel y disponibilidad de cada vendedor" },
  { id: "auditoria", nombre: "Historial y auditoría", subtitulo: "Cada ejecución con sus parámetros y su trazabilidad" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const fechaLarga = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

export function Consola() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("resumen");
  const [sesion, setSesion] = useState<UsuarioSesion | null | undefined>(undefined); // undefined = comprobando
  const [avisoIngreso, setAvisoIngreso] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [detalle, setDetalle] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // sube cada vez que cambia la traza
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

  const aplicar = useCallback((d: Datos) => {
    setDatos(d);
    setFecha((x) => x || d.fecha);
    setError(null);
  }, []);
  // Una respuesta 401 en cualquier momento (sesión vencida) devuelve a la pantalla de ingreso.
  const falla = useCallback((e: Error) => {
    if (/inicia sesión|ya no tiene acceso/i.test(e.message)) { setSesion(null); setAvisoIngreso("Tu sesión terminó. Vuelve a ingresar."); }
    else setError(e.message);
  }, []);
  const cargar = useCallback((f?: string) =>
    api<Datos>(f ? `/api/datos?fecha=${f}` : "/api/datos").then(aplicar).catch(falla), [aplicar, falla]);
  useEffect(() => {
    api<{ usuario: UsuarioSesion }>("/api/sesion")
      .then((r) => { setSesion(r.usuario); return api<Datos>("/api/datos").then(aplicar); })
      .catch((e: Error) => { if (/inicia sesión|ya no tiene acceso/i.test(e.message)) setSesion(null); else { setSesion(null); setAvisoIngreso(e.message); } });
  }, [aplicar]);
  const entrar = (u: UsuarioSesion) => { setSesion(u); setAvisoIngreso(null); cargar(); };
  const salir = async () => {
    await fetch("/api/sesion", { method: "DELETE" });
    setSesion(null); setDatos(null); setDetalle(null); setSeleccion(new Set()); setFecha(""); setAvisoIngreso(null);
  };

  const cambioTraza = async (mensaje: string) => {
    setAviso(mensaje); setVersion((v) => v + 1); setSeleccion(new Set());
    await cargar(fecha);
    setTimeout(() => setAviso(null), 7000);
  };

  const kpis = useMemo(() => {
    if (!datos) return null;
    const pend = datos.registros.filter((r) => r.estado === "nuevo");
    const esperas = pend.map((r) => esperaDe(r, datos.fecha) ?? 0);
    const vend = datos.usuarios.filter((u) => u.rol === "vendedor");
    const disp = vend.filter((u) => u.activo && !u.ausencia && !u.ausencia_proxima && (u.capacidad_efectiva ?? 0) > u.carga);
    const cap = vend.filter((u) => u.activo && u.capacidad_efectiva).reduce((s, u) => s + (u.capacidad_efectiva ?? 0), 0);
    const uso = vend.filter((u) => u.activo && u.capacidad_efectiva).reduce((s, u) => s + u.carga, 0);
    return {
      pendientes: pend.length, masAntiguo: esperas.length ? Math.max(...esperas) : 0, conEspera: esperas.filter((d) => d >= 7).length,
      disponibles: disp.length, vendedores: vend.length, ocupacion: cap ? Math.round((uso / cap) * 100) : 0,
    };
  }, [datos]);

  if (sesion === undefined) return <p className="m-8 text-slate-500">Cargando…</p>;
  if (sesion === null) return <Ingreso alEntrar={entrar} aviso={avisoIngreso} />;
  if (error) return <p className="m-8 rounded-lg bg-rose-50 p-4 text-rose-800">No se pudo cargar: {error}</p>;
  if (!datos || !kpis) return <p className="m-8 text-slate-500">Cargando…</p>;

  const ICONOS = { resumen: <IconoResumen />, reparto: <IconoRepartir />, comparador: <IconoComparar />, registros: <IconoRegistros />, equipo: <IconoEquipo />, auditoria: <IconoAuditoria /> };
  const actual = TABS.find((t) => t.id === tab)!;
  const ini = sesion.nombre.split(" ").slice(0, 2).map((x) => x[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="flex flex-col gap-1 bg-navy px-3 py-3 text-slate-300 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:px-4 lg:py-5">
        <div className="flex items-center gap-3 px-2 pb-3 lg:pb-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"><IconoMarca /></span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Asignación comercial</p>
            <p className="text-xs text-slate-400">Prueba técnica BIA</p>
          </div>
        </div>
        <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${tab === t.id ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-brand-500)]" : "hover:bg-white/5 hover:text-white"}`}>
              {ICONOS[t.id]}<span className="whitespace-nowrap">{t.nombre}</span>
              {t.id === "reparto" && seleccion.size > 0 && <span className="ml-auto rounded-full bg-brand-600 px-1.5 text-xs text-white">{seleccion.size}</span>}
              {t.id === "resumen" && kpis.pendientes > 0 && <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 text-xs text-amber-300">{kpis.pendientes}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden space-y-3 border-t border-white/10 pt-4 lg:block">
          <label className="block text-xs text-slate-400" title="El hoy de la operación: con esta fecha se miran las ausencias, el ingreso y la antigüedad. Por defecto es la del último movimiento registrado en los datos. Queda guardada en la traza.">Fecha de operación
            <input type="date" className={`${campo} mt-1 w-full text-slate-900`} value={fecha}
              onChange={(e) => { setFecha(e.target.value); if (e.target.value) cargar(e.target.value); }} />
          </label>
          {fecha !== datos.fecha_reloj && (
            <p className="text-xs leading-relaxed text-slate-400">Datos al {fechaLarga(datos.fecha_datos)}; hoy es {fechaLarga(datos.fecha_reloj)}.{" "}
              <button className="underline hover:text-white" onClick={() => { setFecha(datos.fecha_reloj); cargar(datos.fecha_reloj); }}>Usar hoy</button>
              {fecha !== datos.fecha_datos && <>{" · "}<button className="underline hover:text-white" onClick={() => { setFecha(datos.fecha_datos); cargar(datos.fecha_datos); }}>Fecha de los datos</button></>}
            </p>
          )}
          <p className="text-[11px] text-slate-500" title="Commit desplegado. Si no coincide con el último, recarga con Ctrl+F5.">Versión {process.env.NEXT_PUBLIC_VERSION}</p>
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white" aria-hidden="true">{ini}</span>
            <div className="min-w-0 flex-1 leading-tight"><p className="truncate text-sm font-medium text-white">{sesion.nombre}</p><p className="text-xs text-slate-400">{sesion.rol}</p></div>
            <button className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión"><IconoSalir /></button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-navy">{actual.nombre}</h1>
            <p className="text-sm text-slate-500">{actual.subtitulo}</p>
          </div>
          <div className="flex items-center gap-2 text-sm lg:hidden">
            <input type="date" aria-label="Fecha de operación" className={campo} value={fecha} onChange={(e) => { setFecha(e.target.value); if (e.target.value) cargar(e.target.value); }} />
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700" onClick={salir}>Salir</button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[90rem] px-5 pb-16 pt-6 lg:px-8">
          {tab === "resumen" && (
            <section aria-label="Indicadores" className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Kpi etiqueta="Pendientes" valor={kpis.pendientes} nota={`${kpis.conEspera} esperan 7 días o más`} tono={kpis.conEspera ? "ambar" : "gris"} />
              <Kpi etiqueta="Más antiguo sin tocar" valor={`${kpis.masAntiguo} d`} nota="desde su creación" tono={kpis.masAntiguo >= 14 ? "rojo" : "gris"} />
              <Kpi etiqueta="Vendedores disponibles" valor={`${kpis.disponibles}/${kpis.vendedores}`} nota="activos, sin ausencia (ni próxima) y con cupo" />
              <Kpi etiqueta="Ocupación del equipo" valor={`${kpis.ocupacion}%`} nota="carga sobre capacidad" tono={kpis.ocupacion >= 85 ? "rojo" : "gris"} progreso={kpis.ocupacion / 100} />
            </section>
          )}

          {aviso && <p role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{aviso}</p>}

          {tab === "resumen" && <Resumen datos={datos} abrir={setDetalle} irA={setTab} />}
          {tab === "comparador" && <Comparador key={`${fecha}-${version}`} fecha={fecha || datos.fecha} irARepartir={() => setTab("reparto")} />}
          {tab === "reparto" && <Reparto datos={datos} actor={sesion.id} fecha={fecha} abrir={setDetalle} alEjecutar={cambioTraza} seleccion={seleccion} setSeleccion={setSeleccion} />}
          {tab === "registros" && <Registros datos={datos} abrir={setDetalle} seleccion={seleccion} setSeleccion={setSeleccion} irARepartir={() => setTab("reparto")} irAAuditoria={() => setTab("auditoria")} />}
          {tab === "equipo" && <Equipo datos={datos} />}
          {tab === "auditoria" && <Auditoria version={version} />}
        </div>
      </main>

      {detalle !== null && (
        <Detalle key={detalle} id={detalle} datos={datos} actor={sesion.id} fecha={fecha} version={version}
          cerrar={() => setDetalle(null)} alCambiar={cambioTraza} />
      )}
    </div>
  );
}

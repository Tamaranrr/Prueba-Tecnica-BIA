"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Datos } from "@/lib/cliente";
import { Auditoria } from "./Auditoria";
import { Detalle } from "./Detalle";
import { Equipo } from "./Equipo";
import { Ingreso, type UsuarioSesion } from "./Ingreso";
import { Registros } from "./Registros";
import { Reparto } from "./Reparto";
import { esperaDe } from "./TablaRegistros";
import { campo, Kpi } from "./ui";

const TABS = [
  { id: "reparto", nombre: "Repartir" },
  { id: "registros", nombre: "Registros" },
  { id: "equipo", nombre: "Equipo" },
  { id: "auditoria", nombre: "Auditoría" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const fechaLarga = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

export function Consola() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("reparto");
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Motor de asignación comercial</h1>
            <p className="text-sm text-slate-400">Reparto con previsualización y traza completa</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-300">Sesión: <b className="text-white">{sesion.nombre}</b> ({sesion.rol})</span>
            <button className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:bg-slate-800" onClick={salir}>Cerrar sesión</button>
            <label className="flex items-center gap-2 text-slate-300" title="El 'hoy' de la operación: con esta fecha se miran las ausencias, el ingreso y la antigüedad. Por defecto es la del último movimiento registrado en los datos. Queda guardada en la traza.">Fecha de operación
              <input type="date" className={`${campo} text-slate-900`} value={fecha}
                onChange={(e) => { setFecha(e.target.value); if (e.target.value) cargar(e.target.value); }} />
            </label>
            {fecha !== datos.fecha_reloj && (
              <span className="text-xs text-slate-400">Datos al {fechaLarga(datos.fecha_datos)}; hoy es {fechaLarga(datos.fecha_reloj)}.{" "}
                <button className="underline hover:text-white" onClick={() => { setFecha(datos.fecha_reloj); cargar(datos.fecha_reloj); }}>Usar hoy</button>
                {fecha !== datos.fecha_datos && <>{" · "}<button className="underline hover:text-white" onClick={() => { setFecha(datos.fecha_datos); cargar(datos.fecha_datos); }}>Volver a la fecha de los datos</button></>}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pb-16">
        <section aria-label="Resumen" className="grid grid-cols-2 gap-3 py-5 lg:grid-cols-4">
          <Kpi etiqueta="Pendientes" valor={kpis.pendientes} nota={`${kpis.conEspera} esperan 7 días o más`} tono={kpis.conEspera ? "ambar" : "gris"} />
          <Kpi etiqueta="Más antiguo sin tocar" valor={`${kpis.masAntiguo} d`} nota="desde su creación" tono={kpis.masAntiguo >= 14 ? "rojo" : "gris"} />
          <Kpi etiqueta="Vendedores disponibles" valor={`${kpis.disponibles}/${kpis.vendedores}`} nota="activos, sin ausencia (ni próxima) y con cupo" />
          <Kpi etiqueta="Ocupación del equipo" valor={`${kpis.ocupacion}%`} nota="carga sobre capacidad" tono={kpis.ocupacion >= 85 ? "rojo" : "gris"} />
        </section>

        <nav className="mb-5 inline-flex rounded-xl bg-slate-200/70 p-1" aria-label="Secciones">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === t.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              {t.nombre}{t.id === "reparto" && seleccion.size > 0 ? <span className="ml-1.5 rounded-full bg-indigo-600 px-1.5 text-xs text-white">{seleccion.size}</span> : null}
            </button>
          ))}
        </nav>

        {aviso && <p role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{aviso}</p>}

        {tab === "reparto" && <Reparto datos={datos} actor={sesion.id} fecha={fecha} abrir={setDetalle} alEjecutar={cambioTraza} seleccion={seleccion} setSeleccion={setSeleccion} />}
        {tab === "registros" && <Registros datos={datos} abrir={setDetalle} seleccion={seleccion} setSeleccion={setSeleccion} irARepartir={() => setTab("reparto")} />}
        {tab === "equipo" && <Equipo datos={datos} />}
        {tab === "auditoria" && <Auditoria version={version} />}
      </div>

      {detalle !== null && (
        <Detalle key={detalle} id={detalle} datos={datos} actor={sesion.id} fecha={fecha} version={version}
          cerrar={() => setDetalle(null)} alCambiar={cambioTraza} />
      )}
    </div>
  );
}

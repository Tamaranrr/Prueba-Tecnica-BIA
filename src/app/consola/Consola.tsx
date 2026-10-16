"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Datos } from "@/lib/cliente";
import { Auditoria } from "./Auditoria";
import { Detalle } from "./Detalle";
import { Equipo } from "./Equipo";
import { Registros } from "./Registros";
import { Reparto } from "./Reparto";
import { campo } from "./ui";

const TABS = [
  { id: "reparto", nombre: "Repartir" },
  { id: "registros", nombre: "Registros" },
  { id: "equipo", nombre: "Equipo" },
  { id: "auditoria", nombre: "Auditoría" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function Consola() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("reparto");
  const [actor, setActor] = useState<number | null>(null);
  const [fecha, setFecha] = useState("");
  const [detalle, setDetalle] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // sube cada vez que cambia la traza

  const aplicar = useCallback((d: Datos) => {
    setDatos(d);
    setFecha((x) => x || d.fecha);
    setActor((a) => a ?? d.usuarios.find((u) => u.rol === "admin")?.id ?? null);
    setError(null);
  }, []);
  const cargar = useCallback((f?: string) =>
    api<Datos>(f ? `/api/datos?fecha=${f}` : "/api/datos").then(aplicar).catch((e: Error) => setError(e.message)), [aplicar]);
  useEffect(() => {
    api<Datos>("/api/datos").then(aplicar).catch((e: Error) => setError(e.message));
  }, [aplicar]);

  const cambioTraza = async (mensaje: string) => {
    setAviso(mensaje); setVersion((v) => v + 1);
    await cargar(fecha);
    setTimeout(() => setAviso(null), 6000);
  };

  if (error) return <p className="m-8 rounded bg-red-50 p-4 text-red-800">No se pudo cargar: {error}</p>;
  if (!datos) return <p className="m-8 text-slate-500">Cargando…</p>;

  const ejecutores = datos.usuarios.filter((u) => ["admin", "lider"].includes(u.rol) && u.activo);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Motor de asignación comercial</h1>
          <p className="text-sm text-slate-500">
            {datos.registros.filter((r) => r.estado === "nuevo").length} registros pendientes · {datos.usuarios.filter((u) => u.rol === "vendedor" && u.activo).length} vendedores activos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-slate-600">Ejecuta
            <select className={campo} value={actor ?? ""} onChange={(e) => setActor(Number(e.target.value))}>
              {ejecutores.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-slate-600" title="Fecha usada para ausencias, ingreso y antigüedad. Queda guardada en la traza.">Fecha de referencia
            <input type="date" className={campo} value={fecha} onChange={(e) => { setFecha(e.target.value); cargar(e.target.value); }} />
          </label>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t.nombre}
          </button>
        ))}
      </nav>

      {aviso && <p role="status" className="mb-4 rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{aviso}</p>}

      {tab === "reparto" && <Reparto datos={datos} actor={actor} fecha={fecha} abrir={setDetalle} alEjecutar={cambioTraza} />}
      {tab === "registros" && <Registros datos={datos} abrir={setDetalle} />}
      {tab === "equipo" && <Equipo datos={datos} />}
      {tab === "auditoria" && <Auditoria version={version} />}

      {detalle !== null && (
        <Detalle key={detalle} id={detalle} datos={datos} actor={actor} fecha={fecha} version={version}
          cerrar={() => setDetalle(null)} alCambiar={cambioTraza} />
      )}
    </div>
  );
}

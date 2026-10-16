"use client";

import { useMemo, useState, type ReactNode } from "react";
import { fmtMoneda, type Datos, type RegistroConsola } from "@/lib/cliente";
import { diasEntre } from "@/lib/engine/filtros";
import { esVivo } from "@/lib/engine/tipos";
import { Badge, Banderas, boton, campo } from "./ui";

// autoasignado (lo asignó el motor) va en azul; nuevo pasa a ámbar para no confundirse con él.
const TONO_ESTADO = { nuevo: "ambar", autoasignado: "azul", asignado: "violeta", en_gestion: "verde", descartado: "gris" } as const;
const ALERTAS: Record<string, { nombre: string; test: (r: RegistroConsola) => boolean }> = {
  con: { nombre: "Con alertas", test: (r) => alertasDe(r).length > 0 },
  sin: { nombre: "Sin alertas", test: (r) => alertasDe(r).length === 0 },
  posible_duplicado: { nombre: "Posible duplicado", test: (r) => r.banderas.includes("posible_duplicado") },
  pidio_no_insistir: { nombre: "Pidió no insistir", test: (r) => r.banderas.includes("pidio_no_insistir") },
  base_sin_validar: { nombre: "Base sin validar", test: (r) => r.banderas.includes("base_sin_validar") },
  datos_incompletos: { nombre: "Datos incompletos", test: (r) => r.banderas.some((b) => ["sin_sector", "sin_empleados", "sin_ingresos", "sin_zona"].includes(b)) },
};
const alertasDe = (r: RegistroConsola) => r.banderas.filter((b) => ["posible_duplicado", "pidio_no_insistir", "base_sin_validar", "sin_zona"].includes(b));

const METODO: Record<string, string> = { ia: "IA", reglas: "Reglas", balanceo_carga: "Balanceo de carga", round_robin: "Round-robin", manual: "Manual" };
/** "Diana Marcela Ospina (admin #1)" -> "Diana Marcela Ospina" */
const soloNombre = (s: string) => s.replace(/\s*\(.*\)\s*$/, "");
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

type Clave = "razon_social" | "zona" | "segmento" | "empleados" | "ingresos_estimados" | "espera" | "estado" | "prioridad";

export interface Filtros { q: string; estado: string; zona: string; segmento: string; fuente: string; dueno: string; alerta: string; espera: string }
const VACIOS: Filtros = { q: "", estado: "", zona: "", segmento: "", fuente: "", dueno: "", alerta: "", espera: "" };

/** Días que lleva esperando un registro nuevo (null si ya tiene trabajo encima). */
export const esperaDe = (r: RegistroConsola, fecha: string) => (r.estado === "nuevo" ? Math.max(0, diasEntre(r.fecha_creacion, fecha)) : null);

export function TablaRegistros({ datos, base, seleccion, setSeleccion, abrir, estadoFijo, alto = "34rem", acciones, soloEjecucion }: {
  datos: Datos; base: RegistroConsola[]; seleccion: Set<number>; setSeleccion: (s: Set<number>) => void;
  abrir: (id: number) => void; estadoFijo?: boolean; alto?: string; acciones?: ReactNode;
  /** Muestra solo los registros asignados en esa ejecución (el último reparto). */
  soloEjecucion?: string | null;
}) {
  const [f, setF] = useState<Filtros>(VACIOS);
  // En la lista de pendientes manda la prioridad de reparto; en Registros, quien más lleva esperando.
  const [orden, setOrden] = useState<{ clave: Clave; asc: boolean }>(estadoFijo ? { clave: "prioridad", asc: true } : { clave: "espera", asc: false });
  const nombre = (id: number | null) => datos.usuarios.find((u) => u.id === id)?.nombre ?? "sin dato";
  const set = (k: keyof Filtros) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const ultima = datos.ultima_ejecucion?.id ?? null;

  const COLUMNAS: { id: Clave | null; titulo: string; alinear?: "right" }[] = estadoFijo
    ? [{ id: "prioridad", titulo: "Prioridad" }, { id: "razon_social", titulo: "Empresa" }, { id: "zona", titulo: "Zona" }, { id: "segmento", titulo: "Segmento" },
       { id: "ingresos_estimados", titulo: "Ingresos", alinear: "right" }, { id: "espera", titulo: "Espera", alinear: "right" }]
    : [{ id: "razon_social", titulo: "Empresa" }, { id: "zona", titulo: "Zona" }, { id: "segmento", titulo: "Segmento" },
       { id: "ingresos_estimados", titulo: "Ingresos", alinear: "right" }, { id: "estado", titulo: "Estado" },
       { id: null, titulo: "Asignado a" }, { id: null, titulo: "Por qué" }];

  const fuentes = useMemo(() => [...new Set(base.map((r) => r.fuente))].sort(), [base]);
  const duenos = useMemo(() => [...new Set(base.filter((r) => esVivo(r.estado)).map((r) => r.dueno_id).filter((x): x is number => x !== null))], [base]);

  const filas = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const minEspera = f.espera ? Number(f.espera) : null;
    const out = base.filter((r) =>
      (!soloEjecucion || r.asignacion?.ejecucion_id === soloEjecucion) &&
      (!q || `${r.razon_social} ${r.nit} ${r.ciudad} ${r.sector ?? ""} ${r.notas ?? ""}`.toLowerCase().includes(q)) &&
      (!f.estado || r.estado === f.estado) && (!f.zona || r.zona === f.zona) && (!f.segmento || r.segmento === f.segmento) &&
      (!f.fuente || r.fuente === f.fuente) &&
      (!f.dueno || (f.dueno === "sin" ? r.estado === "nuevo" : r.dueno_id === Number(f.dueno) && esVivo(r.estado))) &&
      (!f.alerta || ALERTAS[f.alerta].test(r)) &&
      (minEspera === null || (esperaDe(r, datos.fecha) ?? -1) >= minEspera));
    const valor = (r: RegistroConsola): string | number => {
      if (orden.clave === "espera") return esperaDe(r, datos.fecha) ?? -1;
      if (orden.clave === "prioridad") return r.prioridad?.posicion ?? 100_000;   // los retenidos van al final
      const v = r[orden.clave as keyof RegistroConsola];
      return typeof v === "number" ? v : v === null || v === undefined ? "" : String(v);
    };
    return out.sort((a, b) => {
      const x = valor(a), y = valor(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
      return (orden.asc ? c : -c) || a.id - b.id;
    });
  }, [base, f, orden, datos.fecha, soloEjecucion]);

  const activos = Object.entries(f).filter(([k, v]) => v && !(estadoFijo && k === "estado")).length;
  const idsFiltrados = filas.map((r) => r.id);
  const marcadosAqui = idsFiltrados.filter((id) => seleccion.has(id)).length;
  const todos = idsFiltrados.length > 0 && marcadosAqui === idsFiltrados.length;
  const alternarTodos = () => {
    const n = new Set(seleccion);
    if (todos) idsFiltrados.forEach((id) => n.delete(id)); else idsFiltrados.forEach((id) => n.add(id));
    setSeleccion(n);
  };
  const alternar = (id: number) => { const n = new Set(seleccion); if (n.has(id)) n.delete(id); else n.add(id); setSeleccion(n); };
  const columnas = 3 + COLUMNAS.length;

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input aria-label="Buscar" className={`${campo} sm:col-span-2`} placeholder="Buscar por empresa, NIT, ciudad, sector o nota" value={f.q} onChange={(e) => set("q")(e.target.value)} />
        {!estadoFijo && (
          <select aria-label="Estado" className={campo} value={f.estado} onChange={(e) => set("estado")(e.target.value)}>
            <option value="">Todos los estados</option>{["nuevo", "autoasignado", "asignado", "en_gestion", "descartado"].map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
          </select>
        )}
        <select aria-label="Zona" className={campo} value={f.zona} onChange={(e) => set("zona")(e.target.value)}>
          <option value="">Todas las zonas</option>{["Centro", "Costa", "Occidente", "Antioquia"].map((z) => <option key={z}>{z}</option>)}
        </select>
        <select aria-label="Segmento" className={campo} value={f.segmento} onChange={(e) => set("segmento")(e.target.value)}>
          <option value="">Todos los segmentos</option>{["corporativo", "industrial", "pyme"].map((z) => <option key={z}>{z}</option>)}
        </select>
        <select aria-label="Fuente" className={campo} value={f.fuente} onChange={(e) => set("fuente")(e.target.value)}>
          <option value="">Todas las fuentes</option>{fuentes.map((z) => <option key={z}>{z}</option>)}
        </select>
        {!estadoFijo && (
          <select aria-label="Dueño" className={campo} value={f.dueno} onChange={(e) => set("dueno")(e.target.value)}>
            <option value="">Cualquier dueño</option><option value="sin">Sin dueño (nuevos)</option>
            {duenos.map((id) => <option key={id} value={id}>{nombre(id)}</option>)}
          </select>
        )}
        <select aria-label="Alertas" className={campo} value={f.alerta} onChange={(e) => set("alerta")(e.target.value)}>
          <option value="">Con o sin alertas</option>{Object.entries(ALERTAS).map(([k, a]) => <option key={k} value={k}>{a.nombre}</option>)}
        </select>
        <select aria-label="Espera" className={campo} value={f.espera} onChange={(e) => set("espera")(e.target.value)}>
          <option value="">Cualquier espera</option><option value="7">Esperan 7 días o más</option><option value="14">Esperan 14 días o más</option><option value="30">Esperan 30 días o más</option>
        </select>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          <b className="text-slate-900">{filas.length}</b> de {base.length} registros
          {marcadosAqui > 0 && <> · <b className="text-indigo-700">{marcadosAqui}</b> seleccionados</>}
          {seleccion.size > marcadosAqui && <span className="text-slate-500"> ({seleccion.size - marcadosAqui} más fuera de este filtro)</span>}
        </span>
        <span className="flex flex-wrap gap-2">
          {activos > 0 && <button className={boton()} onClick={() => setF((x) => ({ ...VACIOS, estado: estadoFijo ? x.estado : "" }))}>Limpiar {activos} filtro{activos > 1 ? "s" : ""}</button>}
          {seleccion.size > 0 && <button className={boton()} onClick={() => setSeleccion(new Set())}>Quitar selección</button>}
          {acciones}
        </span>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: alto }}>
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Seleccionar todos los filtrados" checked={todos} onChange={alternarTodos} /></th>
              {COLUMNAS.map((c) => (
                <th key={c.titulo} className={`px-3 py-2 ${c.alinear === "right" ? "text-right" : ""}`} aria-sort={c.id && orden.clave === c.id ? (orden.asc ? "ascending" : "descending") : "none"}>
                  {c.id
                    ? <button className="font-semibold uppercase hover:text-slate-900" onClick={() => setOrden((o) => ({ clave: c.id as Clave, asc: o.clave === c.id ? !o.asc : c.id === "razon_social" || c.id === "prioridad" }))}>
                        {c.titulo}{orden.clave === c.id ? (orden.asc ? " ▲" : " ▼") : ""}
                      </button>
                    : <span className="font-semibold uppercase">{c.titulo}</span>}
                </th>
              ))}
              <th className="px-3 py-2">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => {
              const espera = esperaDe(r, datos.fecha);
              const a = r.asignacion;
              const reciente = !!a && a.ejecucion_id === ultima;
              return (
                <tr key={r.id} className={`border-t border-slate-100 align-top hover:bg-indigo-50/40 ${seleccion.has(r.id) ? "bg-indigo-50/60" : reciente ? "bg-blue-50/50" : ""}`}>
                  <td className="px-3 py-2"><input type="checkbox" aria-label={`Seleccionar ${r.razon_social}`} checked={seleccion.has(r.id)} onChange={() => alternar(r.id)} /></td>
                  {estadoFijo && (
                    <td className="px-3 py-2 tabular-nums" title={r.prioridad?.razon}>
                      {r.prioridad ? <b className="text-slate-900">#{r.prioridad.posicion}</b> : <Badge tono="ambar" titulo={r.retenido?.join(", ")}>retenido</Badge>}
                    </td>
                  )}
                  <td className="cursor-pointer px-3 py-2 font-medium text-slate-900 hover:underline" onClick={() => abrir(r.id)}>{r.razon_social}</td>
                  <td className="px-3 py-2">{r.zona ?? "sin dato"}</td>
                  <td className="px-3 py-2">{r.segmento}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoneda(r.ingresos_estimados)}</td>
                  {estadoFijo
                    ? <td className="px-3 py-2 text-right tabular-nums">{espera === null ? "" : <span className={espera >= 14 ? "font-semibold text-rose-700" : espera >= 7 ? "font-medium text-amber-700" : ""}>{espera} d</span>}</td>
                    : (
                      <>
                        <td className="px-3 py-2">
                          <Badge tono={TONO_ESTADO[r.estado as keyof typeof TONO_ESTADO]}>{r.estado.replace("_", " ")}</Badge>
                          {reciente && <div className="mt-1 text-[11px] font-medium text-blue-700">último reparto</div>}
                        </td>
                        <td className="min-w-[13rem] px-3 py-2">
                          {a ? (
                            <>
                              <div className="font-medium text-slate-900">{nombre(a.usuario_id)}</div>
                              <div className="text-xs text-slate-500">por {soloNombre(a.por)} · {METODO[a.metodo] ?? a.metodo} · {fechaHora(a.cuando)}</div>
                            </>
                          ) : r.estado === "nuevo"
                            ? <span className="text-slate-400">sin asignar</span>
                            : r.estado === "descartado" ? "" : (
                              <>
                                <div>{nombre(r.dueno_id)}</div>
                                <div className="text-xs text-slate-500">ya lo tenía, de la operación anterior</div>
                              </>
                            )}
                        </td>
                        <td className="min-w-[18rem] max-w-sm px-3 py-2 text-xs text-slate-600">
                          {a ? a.explicacion
                            : r.estado === "nuevo" ? (r.prioridad ? `Pendiente: prioridad #${r.prioridad.posicion} (${r.prioridad.razon}).` : `Retenido para revisión: ${(r.retenido ?? []).map((x) => x.replaceAll("_", " ")).join(", ")}.`)
                            : ""}
                        </td>
                      </>
                    )}
                  <td className="px-3 py-2"><Banderas lista={alertasDe(r)} /></td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr><td colSpan={columnas} className="px-3 py-10 text-center text-slate-500">Ningún registro cumple estos filtros.{activos > 0 && <> <button className="text-indigo-700 underline" onClick={() => setF(VACIOS)}>Limpiar filtros</button></>}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

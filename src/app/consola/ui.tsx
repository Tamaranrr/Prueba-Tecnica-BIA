import type { ReactNode } from "react";
import { marcasDeSenales } from "@/lib/engine/senales";
import type { SenalesNota } from "@/lib/notas";

const TONOS: Record<string, string> = {
  gris: "bg-slate-100 text-slate-700 ring-slate-200", azul: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  verde: "bg-emerald-50 text-emerald-700 ring-emerald-200", ambar: "bg-amber-50 text-amber-800 ring-amber-200",
  rojo: "bg-rose-50 text-rose-700 ring-rose-200", violeta: "bg-violet-50 text-violet-700 ring-violet-200",
};
export function Badge({ children, tono = "gris", titulo }: { children: ReactNode; tono?: keyof typeof TONOS; titulo?: string }) {
  return <span title={titulo} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONOS[tono]}`}>{children}</span>;
}

export function tonoBandera(b: string): keyof typeof TONOS {
  if (/duplicado|no_insistir|inexistente|cero/.test(b)) return "rojo";
  if (/sin_|base_sin|desborde|respaldo/.test(b)) return "ambar";
  return "gris";
}
export const Banderas = ({ lista }: { lista: string[] }) => (
  <span className="flex flex-wrap gap-1">{lista.map((b) => <Badge key={b} tono={tonoBandera(b)}>{b.replaceAll("_", " ")}</Badge>)}</span>
);

export function Barra({ valor, max, extra = 0 }: { valor: number; max: number | null; extra?: number }) {
  if (!max) return <span className="text-xs text-slate-400">sin capacidad</span>;
  const p = Math.min(100, (valor / max) * 100), e = Math.min(100 - p, (extra / max) * 100);
  const lleno = (valor + extra) / max >= 0.9;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
        <div className="flex h-full"><div className={lleno ? "bg-rose-500" : "bg-indigo-600"} style={{ width: `${p}%` }} /><div className="bg-emerald-500" style={{ width: `${e}%` }} /></div>
      </div>
      <span className="text-xs tabular-nums text-slate-600">{valor}{extra ? <b className="text-emerald-600"> +{extra}</b> : null}/{max}</span>
    </div>
  );
}

export const Tarjeta = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
export const Titulo = ({ children }: { children: ReactNode }) =>
  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</h2>;

export const boton = (variante: "primario" | "secundario" | "peligro" = "secundario") =>
  "rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 " +
  { primario: "bg-indigo-600 text-white hover:bg-indigo-700", secundario: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50", peligro: "bg-emerald-600 text-white hover:bg-emerald-700" }[variante];
export const campo = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

export function Kpi({ etiqueta, valor, nota, tono = "gris" }: { etiqueta: string; valor: ReactNode; nota?: string; tono?: "gris" | "ambar" | "rojo" | "verde" }) {
  const color = { gris: "text-slate-900", ambar: "text-amber-700", rojo: "text-rose-700", verde: "text-emerald-700" }[tono];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{valor}</p>
      {nota && <p className="text-xs text-slate-500">{nota}</p>}
    </div>
  );
}

/** Lo que la IA leyó en la nota de un registro: urgencia y señales activas. */
export function LecturaNota({ senales }: { senales?: SenalesNota | null }) {
  if (!senales) return null;
  const urg = { alta: "rojo", normal: "gris", baja: "azul" } as const;
  return (
    <span className="inline-flex flex-wrap items-center gap-1" title={senales.razon}>
      <Badge tono={urg[senales.urgencia]}>urgencia {senales.urgencia}</Badge>
      {marcasDeSenales(senales).map((m) => <Badge key={m} tono="violeta">{m}</Badge>)}
    </span>
  );
}

import type { ReactNode } from "react";

const TONOS: Record<string, string> = {
  gris: "bg-slate-100 text-slate-700", azul: "bg-blue-100 text-blue-800", verde: "bg-emerald-100 text-emerald-800",
  ambar: "bg-amber-100 text-amber-800", rojo: "bg-red-100 text-red-800", violeta: "bg-violet-100 text-violet-800",
};
export function Badge({ children, tono = "gris", titulo }: { children: ReactNode; tono?: keyof typeof TONOS; titulo?: string }) {
  return <span title={titulo} className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONOS[tono]}`}>{children}</span>;
}

export function tonoBandera(b: string): keyof typeof TONOS {
  if (/duplicado|no_insistir|inexistente|cero/.test(b)) return "rojo";
  if (/sin_|base_sin|desborde/.test(b)) return "ambar";
  return "gris";
}
export const Banderas = ({ lista }: { lista: string[] }) => (
  <span className="flex flex-wrap gap-1">{lista.map((b) => <Badge key={b} tono={tonoBandera(b)}>{b.replaceAll("_", " ")}</Badge>)}</span>
);

export function Barra({ valor, max, extra = 0 }: { valor: number; max: number | null; extra?: number }) {
  if (!max) return <span className="text-xs text-slate-400">sin capacidad</span>;
  const p = Math.min(100, (valor / max) * 100), e = Math.min(100 - p, (extra / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded bg-slate-200">
        <div className="flex h-full"><div className="bg-blue-600" style={{ width: `${p}%` }} /><div className="bg-emerald-500" style={{ width: `${e}%` }} /></div>
      </div>
      <span className="text-xs tabular-nums text-slate-600">{valor}{extra ? <b className="text-emerald-600"> +{extra}</b> : null}/{max}</span>
    </div>
  );
}

export const Tarjeta = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
export const Titulo = ({ children }: { children: ReactNode }) => <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;

export const boton = (variante: "primario" | "secundario" | "peligro" = "secundario") =>
  "rounded px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 " +
  { primario: "bg-blue-700 text-white hover:bg-blue-800", secundario: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50", peligro: "bg-emerald-700 text-white hover:bg-emerald-800" }[variante];
export const campo = "rounded border border-slate-300 bg-white px-2 py-1.5 text-sm";

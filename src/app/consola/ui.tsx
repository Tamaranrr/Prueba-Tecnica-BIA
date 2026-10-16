import type { ReactNode } from "react";
import { marcasDeSenales } from "@/lib/engine/senales";
import type { SenalesNota } from "@/lib/notas";

const TONOS: Record<string, string> = {
  gris: "bg-slate-100 text-slate-700 ring-slate-200", azul: "bg-brand-50 text-brand-700 ring-brand-200",
  verde: "bg-emerald-50 text-emerald-700 ring-emerald-200", ambar: "bg-amber-50 text-amber-800 ring-amber-200",
  rojo: "bg-rose-50 text-rose-700 ring-rose-200", violeta: "bg-violet-50 text-violet-700 ring-violet-200",
};
export type Tono = keyof typeof TONOS;

export function Badge({ children, tono = "gris", titulo }: { children: ReactNode; tono?: Tono; titulo?: string }) {
  return <span title={titulo} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONOS[tono]}`}>{children}</span>;
}

export function tonoBandera(b: string): Tono {
  if (/duplicado|no_insistir|no_contactar|inexistente|cero/.test(b)) return "rojo";
  if (/sin_|base_sin|desborde|respaldo/.test(b)) return "ambar";
  return "gris";
}
export const Banderas = ({ lista }: { lista: string[] }) => (
  <span className="flex flex-wrap gap-1">{lista.map((b) => <Badge key={b} tono={tonoBandera(b)}>{b.replaceAll("_", " ")}</Badge>)}</span>
);

/** Color de la barra según qué tan llena está: verde cómodo, ámbar apretado, rojo saturado. */
export const colorOcupacion = (p: number) => (p >= 0.9 ? "bg-rose-500" : p >= 0.7 ? "bg-amber-500" : "bg-emerald-500");

/** Barra compacta de carga (valor actual + lo que se sumaría en una previsualización). */
export function Barra({ valor, max, extra = 0 }: { valor: number; max: number | null; extra?: number }) {
  if (!max) return <span className="text-xs text-slate-400">sin capacidad</span>;
  const p = Math.min(100, (valor / max) * 100), e = Math.min(100 - p, (extra / max) * 100);
  const total = (valor + extra) / max;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
        <div className="flex h-full"><div className={total >= 0.9 ? "bg-rose-500" : "bg-brand-600"} style={{ width: `${p}%` }} /><div className="bg-emerald-500" style={{ width: `${e}%` }} /></div>
      </div>
      <span className="text-xs tabular-nums text-slate-600">{valor}{extra ? <b className="text-emerald-600"> +{extra}</b> : null}/{max}</span>
    </div>
  );
}

/** Barra ancha con porcentaje y cupos: ocupación = carga ÷ capacidad (lo ocupado, no lo libre). */
export function BarraOcupacion({ valor, max, extra = 0 }: { valor: number; max: number | null; extra?: number }) {
  if (!max) return <span className="text-xs text-slate-400">sin capacidad definida</span>;
  const p = valor / max, e = extra / max;
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`Ocupación ${Math.round(p * 100)}%, ${valor} de ${max}`}>
      <div className="h-2.5 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className="flex h-full">
          <div className={colorOcupacion(p + e)} style={{ width: `${Math.min(100, p * 100)}%` }} />
          {e > 0 && <div className="bg-brand-500" style={{ width: `${Math.min(100 - p * 100, e * 100)}%` }} />}
        </div>
      </div>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-600"><b className="text-sm text-slate-900">{Math.round(p * 100)}%</b> · {valor}/{max}{extra ? <b className="text-brand-700"> +{extra}</b> : null}</span>
    </div>
  );
}

export const Tarjeta = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
export const Titulo = ({ children }: { children: ReactNode }) =>
  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</h2>;

export const boton = (variante: "primario" | "secundario" | "exito" | "peligro" = "secundario") =>
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 " +
  {
    primario: "bg-brand-600 text-white hover:bg-brand-700", exito: "bg-emerald-600 text-white hover:bg-emerald-700",
    secundario: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50", peligro: "bg-rose-600 text-white hover:bg-rose-700",
  }[variante];
export const campo = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

/** Indicador grande del resumen. Si recibe `alAbrir` se vuelve un botón que lleva al detalle. */
export function Kpi({ etiqueta, valor, nota, tono = "gris", progreso, alAbrir, icono }: {
  etiqueta: string; valor: ReactNode; nota?: ReactNode; tono?: "gris" | "ambar" | "rojo" | "verde" | "brand";
  progreso?: number; alAbrir?: () => void; icono?: ReactNode;
}) {
  const color = { gris: "text-slate-900", ambar: "text-amber-700", rojo: "text-rose-700", verde: "text-emerald-700", brand: "text-brand-700" }[tono];
  const contenido = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{etiqueta}</p>
        {icono && <span className="text-slate-400">{icono}</span>}
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${color}`}>{valor}</p>
      {progreso !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={colorOcupacion(progreso)} style={{ width: `${Math.min(100, progreso * 100)}%`, height: "100%" }} /></div>
      )}
      {nota && <p className="mt-1.5 text-xs text-slate-500">{nota}</p>}
    </>
  );
  const base = "rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm";
  return alAbrir
    ? <button onClick={alAbrir} className={`${base} transition hover:border-brand-300 hover:shadow-md`}>{contenido}</button>
    : <div className={base}>{contenido}</div>;
}

/** Círculo con las iniciales: identifica a una persona sin necesitar fotos. */
export function Avatar({ nombre, tam = 32 }: { nombre: string; tam?: number }) {
  const ini = nombre.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  const paleta = ["bg-brand-100 text-brand-800", "bg-emerald-100 text-emerald-800", "bg-amber-100 text-amber-800", "bg-sky-100 text-sky-800", "bg-rose-100 text-rose-800", "bg-violet-100 text-violet-800"];
  const i = [...nombre].reduce((a, c) => a + c.charCodeAt(0), 0) % paleta.length;
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold ${paleta[i]}`} style={{ width: tam, height: tam }} aria-hidden="true">{ini}</span>;
}

export function Vacio({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{titulo}</p>
      {detalle && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{detalle}</p>}
      {accion && <div className="mt-4">{accion}</div>}
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

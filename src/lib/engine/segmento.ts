import type { Registro, Segmento } from "./tipos";

const SECTORES_INDUSTRIALES = new Set([
  "Manufactura", "Metalmecánica", "Química", "Textil", "Minería", "Agroindustria",
  "Alimentos y bebidas", "Construcción",
]);

/** Segmento comercial de una cuenta. Corporativo = grande por empleados o ingresos. */
export function segmentoDe(r: Pick<Registro, "empleados" | "ingresos_estimados" | "sector">): Segmento {
  if ((r.empleados ?? 0) >= 500 || (r.ingresos_estimados ?? 0) >= 30_000_000_000) return "corporativo";
  if (r.sector && SECTORES_INDUSTRIALES.has(r.sector)) return "industrial";
  return "pyme";
}

/** Señales que el coordinador dejó en las notas y que las reglas sí pueden usar. */
export function señalesNota(notas: string | null) {
  const n = (notas ?? "").toLowerCase();
  return {
    pideSenior: /senior/.test(n),
    pideConocerSector: /conozca el sector/.test(n),
  };
}

/** Tamaño para priorizar: las cuentas grandes se reparten primero en el método de reglas. */
export const tamano = (r: Pick<Registro, "empleados" | "ingresos_estimados">) =>
  (r.ingresos_estimados ?? 0) + (r.empleados ?? 0) * 1_000_000;

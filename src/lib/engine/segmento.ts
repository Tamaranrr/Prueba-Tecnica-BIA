import type { Registro, Segmento } from "./tipos";

const SECTORES_INDUSTRIALES = new Set([
  "Manufactura", "Metalmecánica", "Química", "Textil", "Minería", "Agroindustria",
  "Alimentos y bebidas", "Construcción",
]);

/**
 * Cuenta corporativa: la define el INGRESO que representa (18.000 M COP o más). El tamaño solo se usa cuando falta
 * el ingreso (300 empleados o más). En los 167 registros los dos criterios coinciden: hasta 260 empleados los ingresos
 * nunca pasan de 17.700 M, y desde 420 empleados están entre 18.400 y 119.000 M; entre 260 y 420 no hay empresas.
 * Si ambos datos existen y se contradicen, manda el ingreso. Son parámetros de negocio: se cambian aquí.
 */
export const UMBRAL_CORPORATIVO = { ingresos: 18_000_000_000, empleados: 300 } as const;

/** Segmento comercial: corporativo (por ingresos), luego industrial (por sector) y, si no, pyme. */
export function segmentoDe(r: Pick<Registro, "empleados" | "ingresos_estimados" | "sector">): Segmento {
  const corporativo = r.ingresos_estimados !== null && r.ingresos_estimados !== undefined
    ? r.ingresos_estimados >= UMBRAL_CORPORATIVO.ingresos
    : (r.empleados ?? 0) >= UMBRAL_CORPORATIVO.empleados;
  if (corporativo) return "corporativo";
  if (r.sector && SECTORES_INDUSTRIALES.has(r.sector)) return "industrial";
  return "pyme";
}

/** Señales que el coordinador dejó en las notas y que las reglas sí pueden usar. */
export function senalesNota(notas: string | null) {
  const n = (notas ?? "").toLowerCase();
  return {
    pideSenior: /senior/.test(n),
    pideConocerSector: /conozca el sector/.test(n),
  };
}

/** Tamaño de la cuenta para ordenar dentro de un mismo segmento: primero la que más ingresos representa. */
export const tamano = (r: Pick<Registro, "empleados" | "ingresos_estimados">) =>
  (r.ingresos_estimados ?? 0) + (r.empleados ?? 0) * 1_000_000;

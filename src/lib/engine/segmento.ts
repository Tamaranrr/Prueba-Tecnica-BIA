import type { Registro, Segmento } from "./tipos";

const SECTORES_INDUSTRIALES = new Set([
  "Manufactura", "Metalmecánica", "Química", "Textil", "Minería", "Agroindustria",
  "Alimentos y bebidas", "Construcción",
]);

/**
 * Umbrales de "cuenta corporativa". Salen de los datos, no de una intuición: en los 167 registros las empresas
 * forman tres grupos claros. Hasta 260 empleados, sus ingresos nunca pasan de 17.700 M COP; desde 420 empleados
 * (420, 650, 900, 1400, 2100) están entre 18.400 y 119.000 M, con mediana de 50.000 a 78.000 M. No hay empresas
 * entre 260 y 420 empleados, así que cualquier corte en ese hueco separa igual. Se usa 300 y 18.000 M COP.
 * (El umbral anterior, 500 empleados, dejaba fuera como "no corporativas" las 420 empleados, que son del grupo grande.)
 * Son parámetros de negocio: si cambia la definición de cuenta grande, se cambian aquí.
 */
export const UMBRAL_CORPORATIVO = { empleados: 300, ingresos: 18_000_000_000 } as const;

/** Segmento comercial de una cuenta. Corporativo = grande por empleados o por ingresos; luego, sector fabril o agro. */
export function segmentoDe(r: Pick<Registro, "empleados" | "ingresos_estimados" | "sector">): Segmento {
  if ((r.empleados ?? 0) >= UMBRAL_CORPORATIVO.empleados || (r.ingresos_estimados ?? 0) >= UMBRAL_CORPORATIVO.ingresos) return "corporativo";
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

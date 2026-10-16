import type { SenalesNota } from "../notas";

/** Marcas activas de la lectura de una nota, en texto corto (se usa en el prompt y en la consola). */
export function marcasDeSenales(x: SenalesNota): string[] {
  return [
    x.perfil_senior && "pide perfil senior", x.experto_sector && "pide experto del sector",
    x.necesidad_industrial && "necesidad industrial", x.recuperacion_cliente && "fue cliente antes",
    x.no_contactar && "pidió no ser contactado", x.dato_poco_confiable && "datos poco confiables",
  ].filter((m): m is string => !!m);
}

export function descripcionSenales(x: SenalesNota) {
  const marcas = marcasDeSenales(x);
  return `urgencia ${x.urgencia}${marcas.length ? "; " + marcas.join("; ") : ""}`;
}

/** true si la lectura trae algo distinto de "nada que decir". */
export const tieneSenales = (x?: SenalesNota | null) => !!x && (x.urgencia !== "normal" || marcasDeSenales(x).length > 0);

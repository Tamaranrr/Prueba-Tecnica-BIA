import type { Registro } from "./tipos";

/**
 * Un registro nuevo cuyo "gemelo" (mismo NIT o misma razón social) ya está asignado, en gestión o
 * descartado no debe repartirse a ciegas: el equipo ya trabajó o cerró esa empresa. Se marca con
 * `duplicado_en_<estado>_<id>` y el motor lo retiene para revisión humana.
 * Devuelve copias; no modifica los registros recibidos.
 */
export function marcarDuplicadosEnTrabajo(lote: Registro[], todos: Registro[]): Registro[] {
  const raiz = (r: Registro) => r.duplicado_de ?? r.id;
  const grupos = new Map<number, Registro[]>();
  for (const r of todos) grupos.set(raiz(r), [...(grupos.get(raiz(r)) ?? []), r]);
  return lote.map((r) => {
    const otros = (grupos.get(raiz(r)) ?? []).filter((x) => x.id !== r.id && x.estado !== "nuevo");
    if (!otros.length) return r;
    const marcas = otros.map((x) => `duplicado_en_${x.estado}_${x.id}`);
    return { ...r, banderas: [...r.banderas, ...marcas] };
  });
}

import { esVivo, type Actividad, type Registro } from "./tipos";

/** Dueño actual de cada registro: asignación vigente del motor, o si no, el usuario de su última actividad. */
export function duenosActuales(
  actividad: Actividad[],
  asignacionesVigentes: { registro_id: number; usuario_id: number }[] = [],
): Map<number, number> {
  const dueno = new Map<number, number>();
  const ult = [...actividad].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  for (const a of ult) dueno.set(a.registro_id, a.usuario_id);
  for (const v of asignacionesVigentes) dueno.set(v.registro_id, v.usuario_id);
  return dueno;
}

/**
 * Carga actual por usuario: registros vivos (asignado, autoasignado o en gestión) cuyo dueño es el
 * usuario de su última actividad (por fecha, desempate por id).
 * `asignacionesVigentes` (traza propia del motor) manda sobre la actividad histórica.
 */
export function calcularCarga(
  registros: Pick<Registro, "id" | "estado">[],
  actividad: Actividad[],
  asignacionesVigentes: { registro_id: number; usuario_id: number }[] = [],
): Record<number, number> {
  const dueno = duenosActuales(actividad, asignacionesVigentes);
  const carga: Record<number, number> = {};
  for (const r of registros) {
    if (!esVivo(r.estado)) continue;
    const u = dueno.get(r.id);
    if (u !== undefined) carga[u] = (carga[u] ?? 0) + 1;
  }
  return carga;
}

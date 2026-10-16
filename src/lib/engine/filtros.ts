import type { Ausencia, EvaluacionCandidato, ParametrosMotor, Registro, Usuario } from "./tipos";

const MS_DIA = 86_400_000;
export const diasEntre = (desde: string, hasta: string) =>
  Math.floor((Date.parse(hasta) - Date.parse(desde)) / MS_DIA);

/** Ausencia vigente en la fecha (hasta null = abierta, sin fecha de fin). */
export function ausenciaVigente(ausencias: Ausencia[], usuarioId: number, fecha: string): Ausencia | undefined {
  return ausencias.find((a) => a.usuario_id === usuarioId && a.desde <= fecha && (a.hasta === null || a.hasta >= fecha));
}

export interface ContextoFiltros {
  ausencias: Ausencia[];
  carga: Record<number, number>;
  params: ParametrosMotor;
}

/**
 * Filtros DUROS: lo que ningún método puede saltarse. Un usuario que no los cumple nunca
 * llega a un método ni al modelo de IA. `ignorarZona` se usa solo para el desborde.
 */
export function evaluarCandidato(
  u: Usuario, reg: Pick<Registro, "zona">, ctx: ContextoFiltros, ignorarZona = false,
): EvaluacionCandidato {
  const { params, ausencias, carga } = ctx;
  const fecha = params.fechaReferencia;
  const d: string[] = [];

  if (u.rol === "admin" || (u.rol === "lider" && !params.incluirLideres)) d.push(`rol_${u.rol}_no_asignable`);
  if (params.excluirUsuarios.includes(u.id)) d.push("excluido_del_lote");
  if (!u.activo) d.push("inactivo");
  if (u.fecha_ingreso && u.fecha_ingreso > fecha) d.push(`aun_no_ingresa(${u.fecha_ingreso})`);
  const aus = ausenciaVigente(ausencias, u.id, fecha);
  if (aus) d.push(`ausente(${aus.motivo})`);

  const cap = u.capacidad_maxima;
  const usado = carga[u.id] ?? 0;
  if (cap === null) d.push("sin_capacidad_definida");
  else if (cap <= 0) d.push("capacidad_cero");
  else if (usado >= cap) d.push(`sin_cupo(${usado}/${cap})`);

  if (!ignorarZona && params.zona === "estricta" && reg.zona && u.zona !== reg.zona) d.push(`otra_zona(${u.zona ?? "sin zona"})`);

  return { usuario_id: u.id, nombre: u.nombre, elegible: d.length === 0, descartes: d, carga: usado, capacidad: cap };
}

// Tipos y helpers de la consola (cliente). Reflejan lo que devuelven las rutas /api.
import type { EvaluacionCandidato, ParametrosMotor, Propuesta, Registro, Retenido, Usuario } from "./engine/tipos";

export type UsuarioConsola = Usuario & { carga: number; ausencia: { motivo: string; desde: string; hasta: string | null } | null };
export type RegistroConsola = Registro & { segmento: string; dueno_id: number | null };
export interface Datos { fecha: string; usuarios: UsuarioConsola[]; registros: RegistroConsola[] }

export type PropuestaPreview = Propuesta & { dueno_actual: number | null };
export interface Preview {
  metodo: string; parametros: ParametrosMotor; propuestas: PropuestaPreview[]; retenidos: Retenido[];
  cargaInicial: Record<number, number>; cargaFinal: Record<number, number>;
  resumen: { asignables: number; sin_candidato: number; retenidos: number };
  preview_id?: string; sin_procesar?: number;
}
export interface Ejecucion {
  id: string; tipo: string; metodo: string; parametros: ParametrosMotor; ejecutado_por: string;
  fecha_referencia: string; total_registros: number; creada_en: string;
}
export interface AsignacionTraza {
  id: string; metodo: string; vigente: boolean; creada_en: string; ejecutado_por: string; motivo: string | null;
  reemplaza_a: string | null; candidatos: EvaluacionCandidato[] | null; parametros: Record<string, unknown>;
  prompt_enviado: string | null; respuesta_modelo: string | null; modelo: string | null;
  usuarios: { id: number; nombre: string; rol: string };
  ejecuciones: { tipo: string };
}
export interface Traza {
  registro: Registro;
  asignaciones: AsignacionTraza[];
  actividad: { id: number; usuario_id: number; tipo: string; fecha: string }[];
}

export async function api<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(ruta, cuerpo === undefined ? undefined : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Error inesperado");
  return j as T;
}

export const METODOS = [
  { id: "round_robin", nombre: "Round-robin ponderado", desc: "Rota los registros entre los vendedores elegibles; quien tiene más cupo libre recibe más turnos." },
  { id: "balanceo_carga", nombre: "Balanceo de carga", desc: "Cada registro va al vendedor menos ocupado (carga ÷ capacidad). Nivela a los nuevos con los antiguos." },
  { id: "reglas", nombre: "Reglas de negocio", desc: "Puntúa segmento experto, zona, carga y antigüedad. Las cuentas grandes no van a vendedores nuevos y se respetan las notas (senior, conoce el sector)." },
  { id: "ia", nombre: "Asignación por IA", desc: "Claude lee el registro completo (incluidas las notas) y elige entre los vendedores que ya pasaron los filtros duros. Cada decisión guarda el prompt y la respuesta." },
] as const;

export const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
export const fmtMoneda = (n: number | null) =>
  n === null ? "—" : n >= 1e9 ? `$${(n / 1e9).toFixed(1)} MM` : `$${(n / 1e6).toFixed(0)} M`;

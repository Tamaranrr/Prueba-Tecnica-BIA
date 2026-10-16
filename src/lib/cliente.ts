// Tipos y helpers de la consola (cliente). Reflejan lo que devuelven las rutas /api.
import type { EvaluacionCandidato, ParametrosMotor, Propuesta, Registro, Retenido, ResumenCartera, Usuario } from "./engine/tipos";

export type AusenciaVista = { motivo: string; desde: string; hasta: string | null };
export type UsuarioConsola = Usuario & {
  carga: number;
  /** Capacidad con la que se evalúa (la real, o la provisional de un recién entrado con capacidad 0). */
  capacidad_efectiva: number | null; capacidad_provisional: boolean;
  ausencia: AusenciaVista | null; ausencia_proxima: AusenciaVista | null;
  perfil: ResumenCartera;
};
/** La asignación vigente de un registro: a quién, quién la hizo, cuándo, con qué método y por qué, en lenguaje simple. */
export interface AsignacionVista {
  usuario_id: number; metodo: string; por: string; cuando: string; ejecucion_id: string; explicacion: string;
}
export type RegistroConsola = Registro & {
  segmento: string; dueno_id: number | null;
  /** Solo en registros nuevos: lugar en la cola de reparto y por qué. null si queda retenido. */
  prioridad: { posicion: number; razon: string } | null;
  /** Solo en registros nuevos que no se reparten: por qué quedan para revisión humana. */
  retenido: string[] | null;
  asignacion: AsignacionVista | null;
};
export interface UltimaEjecucion { id: string; tipo: string; metodo: string; ejecutado_por: string; creada_en: string; total_registros: number }
export interface Datos { fecha: string; fecha_datos: string; fecha_reloj: string; usuarios: UsuarioConsola[]; registros: RegistroConsola[]; sin_candidato: number[]; ultima_ejecucion: UltimaEjecucion | null }
export interface Medicion {
  asignados: number; sin_candidato: number; retenidos: number; pct_segmento: number | null; pct_zona: number | null;
  grandes: number; grandes_con_experto: number; personas_con_grandes: number; ocupacion_maxima: number; desbalance: number;
  reglas_rotas: number; respaldos_ia: number;
}
export interface Comparacion {
  fecha: string; pendientes: number;
  filas: { metodo: string; medicion: Medicion; origen?: { preview_id: string; creada_en: string; misma_fecha: boolean } }[];
}

export type PropuestaPreview = Propuesta & { dueno_actual: number | null };
export interface Preview {
  metodo: string; parametros: ParametrosMotor; propuestas: PropuestaPreview[]; retenidos: Retenido[];
  cargaInicial: Record<number, number>; cargaFinal: Record<number, number>;
  resumen: { asignables: number; sin_candidato: number; retenidos: number };
  preview_id?: string; sin_procesar?: number;
  avisos?: string[]; notas?: { distintas: number; nuevas: number };
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
  { id: "reglas", nombre: "Reglas de negocio", desc: "Puntúa segmento experto, zona, carga y antigüedad. Las cuentas grandes solo compiten entre expertos corporativos con antigüedad y se respetan las notas (senior, conoce el sector)." },
  { id: "ia", nombre: "Asignación por IA", desc: "Claude lee el registro completo (incluidas las notas) y elige entre los vendedores que ya pasaron los filtros duros. Cada decisión guarda el prompt y la respuesta." },
] as const;

export const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
export const fmtMoneda = (n: number | null) =>
  n === null ? "sin dato" : n >= 1e9 ? `$${(n / 1e9).toFixed(1)} MM` : `$${(n / 1e6).toFixed(0)} M`;

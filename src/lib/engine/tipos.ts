// Tipos del motor. El motor es PURO: recibe datos, devuelve propuestas; no toca la base.

import type { SenalesNota } from "../notas";
export type { SenalesNota };

export type Zona = "Centro" | "Costa" | "Occidente" | "Antioquia";
export type Segmento = "corporativo" | "pyme" | "industrial";

export interface Usuario {
  id: number; nombre: string; rol: "admin" | "lider" | "vendedor"; equipo_id: number | null;
  zona: string | null; segmento_experto: Segmento | null; capacidad_maxima: number | null;
  fecha_ingreso: string | null; activo: boolean; banderas: string[];
}
export interface Registro {
  id: number; razon_social: string; nit: string; sector: string | null; empleados: number | null;
  ingresos_estimados: number | null; ciudad: string; zona: string | null; fuente: string;
  notas: string | null; estado: string; fecha_creacion: string; duplicado_de: number | null; banderas: string[];
  /** Lectura de la nota hecha por IA (si se pidió y estuvo disponible). El motor la trata como un dato más. */
  senales?: SenalesNota;
}
export interface Ausencia { id: number; usuario_id: number; desde: string; hasta: string | null; motivo: string }
export interface Actividad { id: number; registro_id: number; usuario_id: number; tipo: string; fecha: string }

export type Metodo = "round_robin" | "balanceo_carga" | "reglas" | "ia";

/** Qué hacer cuando el registro tiene una bandera que pide revisión humana. */
export interface ParametrosMotor {
  /** "Hoy" para ausencias, antigüedad y vigencia. Se guarda en la traza → reproducible. */
  fechaReferencia: string;
  /** estricta: solo vendedores de la zona del registro; preferente: zona suma puntos; ignorar: no cuenta. */
  zona: "estricta" | "preferente" | "ignorar";
  /** Si la zona estricta no deja candidatos, desbordar a cualquier zona (queda anotado). */
  desbordarSiNoHay: boolean;
  incluirLideres: boolean;
  /** Estados de registro que se pueden repartir. Por defecto solo "nuevo"; al reasignar se amplía. */
  estados: string[];
  /** Usuarios que no pueden recibir en este lote (ej. el que se reasigna o quien se va). */
  excluirUsuarios: number[];
  /** Registros con estas banderas no se asignan: quedan retenidos para revisión. */
  retener: string[];
  /** Pesos del método "reglas". */
  pesos: PesosReglas;
  /** Método reglas: una cuenta corporativa solo compite entre expertos corporativos elegibles (si hay alguno). */
  grandesSoloExpertos: boolean;
  /** Usa la lectura de las notas: atiende primero lo urgente y aplica perfil senior, sector y necesidad industrial. */
  usarNotasIA: boolean;
}
export interface PesosReglas {
  segmento: number; zona: number; carga: number; antiguedad: number;
  /** Días de antigüedad mínimos para recibir cuentas corporativas. */
  diasMinCorporativo: number;
  /** Años de antigüedad mínimos cuando la nota pide "alguien senior". */
  aniosSenior: number;
}

/**
 * Pesos por defecto del método de reglas, elegidos midiendo sobre los pendientes reales (scripts/evaluar.mts):
 * segmento y zona pesan lo mismo, la carga el doble y la antigüedad solo desempata. Frente a 40/20/30 sube las
 * cuentas en su zona de 51% a 70% y baja la desviación de ocupación de 16.9 a 11.7 puntos, a cambio de bajar el
 * encaje de segmento de 100% a 80%. Las cuentas grandes no dependen de estos pesos: ver grandesSoloExpertos.
 */
export const PESOS_DEFECTO: PesosReglas = { segmento: 30, zona: 30, carga: 60, antiguedad: 10, diasMinCorporativo: 90, aniosSenior: 2 };

/** Perfiles listos para la consola; todos se pueden ajustar a mano. */
export const PERFILES_PESOS: { id: string; nombre: string; desc: string; pesos: PesosReglas }[] = [
  { id: "equilibrado", nombre: "Equilibrado (recomendado)", desc: "Segmento y zona pesan igual; la carga pesa el doble.", pesos: PESOS_DEFECTO },
  { id: "experto", nombre: "Experto primero", desc: "Prioriza que cada cuenta vaya a un experto de su segmento, aunque quede fuera de zona.", pesos: { ...PESOS_DEFECTO, segmento: 40, zona: 20, carga: 30 } },
  { id: "zona", nombre: "Zona primero", desc: "Prioriza que la cuenta quede con alguien de su zona.", pesos: { ...PESOS_DEFECTO, segmento: 20, zona: 40, carga: 30 } },
  { id: "balance", nombre: "Solo balance", desc: "Casi ignora segmento y zona: nivela la carga entre todos.", pesos: { ...PESOS_DEFECTO, segmento: 0, zona: 0, carga: 50 } },
];

export const PARAMETROS_DEFECTO: Omit<ParametrosMotor, "fechaReferencia"> = {
  zona: "estricta", desbordarSiNoHay: true, incluirLideres: false, estados: ["nuevo"], excluirUsuarios: [],
  retener: ["duplicado", "pidio_no_insistir"], grandesSoloExpertos: true, usarNotasIA: true,
  pesos: PESOS_DEFECTO,
};

/** Resultado de evaluar a un usuario para un registro (queda en la traza). */
export interface EvaluacionCandidato {
  usuario_id: number; nombre: string;
  elegible: boolean;
  descartes: string[];                       // por qué NO era elegible
  puntaje?: number; desglose?: Record<string, number>;
  carga: number; capacidad: number | null;
}
export interface Propuesta {
  registro_id: number;
  usuario_id: number | null;                 // null = sin candidato posible
  motivo: string;
  candidatos: EvaluacionCandidato[];
  segmento: Segmento;
  senales?: SenalesNota;                     // lectura de la nota usada en esta decisión
  banderas_decision: string[];               // ej. "desborde_zona"
  // Solo método IA:
  prompt_enviado?: string; respuesta_modelo?: string; modelo?: string;
}
export interface Retenido { registro_id: number; razones: string[] }
export interface ResultadoMotor {
  metodo: Metodo; parametros: ParametrosMotor;
  propuestas: Propuesta[]; retenidos: Retenido[];
  cargaFinal: Record<number, number>;
}

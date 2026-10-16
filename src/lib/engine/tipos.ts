// Tipos del motor. El motor es PURO: recibe datos, devuelve propuestas; no toca la base.

import type { SenalesNota } from "../notas";
export type { SenalesNota };

export type Zona = "Centro" | "Costa" | "Occidente" | "Antioquia";
export type Segmento = "corporativo" | "pyme" | "industrial";
export type Nivel = "rampa" | "junior" | "pleno" | "senior";

/** Estados de un registro que ya tiene trabajo encima y por eso cuenta como cartera viva de alguien. */
export const ESTADOS_VIVOS = ["asignado", "autoasignado", "en_gestion"] as const;
export const esVivo = (estado: string) => (ESTADOS_VIVOS as readonly string[]).includes(estado);

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
  /** Dueño actual cuando el registro ya tiene trabajo encima (lo pone el servicio). Nadie puede recibir su propio registro. */
  dueno_actual?: number | null;
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
  /** Usuarios que no pueden recibir en ningún registro de este lote. */
  excluirUsuarios: number[];
  /** Registros con estas banderas no se asignan: quedan retenidos para revisión. */
  retener: string[];
  /** Pesos del método "reglas". */
  pesos: PesosReglas;
  /** Método reglas: una cuenta corporativa solo compite entre expertos corporativos elegibles (si hay alguno). */
  grandesSoloExpertos: boolean;
  /** Usa la lectura de las notas: atiende primero lo urgente y aplica perfil senior, sector y necesidad industrial. */
  usarNotasIA: boolean;
  /** No se dan cuentas nuevas a quien se ausenta dentro de estos días (0 = solo se filtra a quien ya está ausente). */
  ventanaAusenciaDias: number;
  /** Capacidad provisional de un vendedor en rampa con capacidad 0 (recién entrado). 0 = no se aplica y queda excluido. */
  capacidadRampa: number;
  /** Un vendedor en rampa solo recibe cuentas pyme (pequeñas). */
  rampaSoloPyme: boolean;
  /** Orden de reparto por segmento: quien va primero elige primero. */
  ordenSegmentos: Segmento[];
  /** Referencia de cuentas corporativas por vendedor: sobre este número ya no suma puntos de balance. */
  topeGrandes: number;
}
export interface PesosReglas {
  segmento: number; zona: number; carga: number; antiguedad: number;
  /** Balance de cuentas grandes: favorece a quien tiene menos cuentas corporativas en cartera. */
  cartera: number;
  /** Días de antigüedad mínimos para recibir cuentas corporativas (730 = nivel pleno). */
  diasMinCorporativo: number;
  /** Años de antigüedad mínimos cuando la nota pide "alguien senior". */
  aniosSenior: number;
}

/**
 * Pesos por defecto del método de reglas, elegidos midiendo sobre los pendientes reales (scripts/evaluar.mts):
 * segmento y zona pesan lo mismo y la carga el doble. La antigüedad y el balance de cuentas grandes pesan 20 cada uno:
 * ya no solo desempatan, porque el caso exige cuidar a los recién entrados y repartir las cuentas grandes entre varios.
 * Las cuentas grandes tampoco dependen de estos pesos: ver grandesSoloExpertos.
 */
export const PESOS_DEFECTO: PesosReglas = { segmento: 30, zona: 30, carga: 60, antiguedad: 20, cartera: 20, diasMinCorporativo: 730, aniosSenior: 2 };

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
  ventanaAusenciaDias: 7, capacidadRampa: 10, rampaSoloPyme: true,
  ordenSegmentos: ["corporativo", "industrial", "pyme"], topeGrandes: 8,
  pesos: PESOS_DEFECTO,
};

/** Cartera de un vendedor en el momento de decidir; queda en la traza. */
export interface ResumenCartera {
  nivel: Nivel; antiguedadDias: number | null; antiguedadEstimada: boolean;
  cuentas: number; corporativo: number; industrial: number; pyme: number; ingresos: number;
  acciones14d: number; diasDesdeUltima: number | null; frias: number;
}

/** Resultado de evaluar a un usuario para un registro (queda en la traza). */
export interface EvaluacionCandidato {
  usuario_id: number; nombre: string;
  elegible: boolean;
  descartes: string[];                       // por qué NO era elegible
  puntaje?: number; desglose?: Record<string, number>;
  carga: number; capacidad: number | null;
  /** true si la capacidad es la provisional de un recién entrado (su capacidad real está en 0). */
  capacidad_provisional?: boolean;
  cartera?: ResumenCartera;
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

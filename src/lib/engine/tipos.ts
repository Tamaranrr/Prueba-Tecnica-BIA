// Tipos del motor. El motor es PURO: recibe datos, devuelve propuestas; no toca la base.

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
  /** Registros con estas banderas no se asignan: quedan retenidos para revisión. */
  retener: string[];
  /** Pesos del método "reglas". */
  pesos: PesosReglas;
}
export interface PesosReglas {
  segmento: number; zona: number; carga: number; antiguedad: number;
  /** Días de antigüedad mínimos para recibir cuentas corporativas. */
  diasMinCorporativo: number;
  /** Años de antigüedad mínimos cuando la nota pide "alguien senior". */
  aniosSenior: number;
}

export const PARAMETROS_DEFECTO: Omit<ParametrosMotor, "fechaReferencia"> = {
  zona: "estricta", desbordarSiNoHay: true, incluirLideres: false,
  retener: ["duplicado", "pidio_no_insistir"],
  pesos: { segmento: 40, zona: 20, carga: 30, antiguedad: 10, diasMinCorporativo: 90, aniosSenior: 2 },
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

import { diasEntre } from "./fechas";
import type { Nivel } from "./tipos";

/**
 * Niveles de antigüedad, medidos a la fecha de operación:
 *  rampa  menos de 6 meses (se está nivelando: solo cuentas pequeñas)
 *  junior menos de 2 años
 *  pleno  menos de 4 años (desde aquí puede llevar cuentas corporativas)
 *  senior 4 años o más
 */
export const LIMITES_NIVEL = { rampa: 180, junior: 730, pleno: 1460 } as const;
export const INDICE_NIVEL: Record<Nivel, number> = { rampa: 0, junior: 1, pleno: 2, senior: 3 };

export interface Antiguedad { nivel: Nivel; dias: number | null; estimada: boolean }

/** Sin fecha de ingreso no hay dato: se asume senior y se marca como estimada (así lo muestra también la consola). */
export function antiguedadDe(fechaIngreso: string | null, fecha: string): Antiguedad {
  if (!fechaIngreso) return { nivel: "senior", dias: null, estimada: true };
  const dias = Math.max(0, diasEntre(fechaIngreso, fecha));
  const nivel: Nivel = dias < LIMITES_NIVEL.rampa ? "rampa" : dias < LIMITES_NIVEL.junior ? "junior" : dias < LIMITES_NIVEL.pleno ? "pleno" : "senior";
  return { nivel, dias, estimada: false };
}

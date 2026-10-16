import { diasEntre } from "./fechas";
import { segmentoDe, tamano } from "./segmento";
import type { ParametrosMotor, Registro } from "./tipos";

type Orden = Pick<ParametrosMotor, "ordenSegmentos" | "usarNotasIA">;

/**
 * Orden de reparto: quien va primero elige primero. Primero el segmento (por defecto corporativo, industrial, pyme),
 * dentro de él lo urgente según la lectura de la nota, luego el que más lleva esperando y por último el que más pesa.
 * Es la única definición del orden: la usan el reparto, la IA y la columna "Prioridad" de la consola.
 */
export function compararPrioridad(params: Orden) {
  const segmento = (r: Registro) => { const i = params.ordenSegmentos.indexOf(segmentoDe(r)); return i < 0 ? params.ordenSegmentos.length : i; };
  const urgencia = (r: Registro) => (params.usarNotasIA ? ({ alta: 0, normal: 1, baja: 2 }[r.senales?.urgencia ?? "normal"]) : 1);
  return (a: Registro, b: Registro) =>
    segmento(a) - segmento(b) || urgencia(a) - urgencia(b) || a.fecha_creacion.localeCompare(b.fecha_creacion) ||
    tamano(b) - tamano(a) || a.id - b.id;
}

/** Por qué un registro va antes o después, en una frase. */
export function razonPrioridad(r: Registro, params: Pick<ParametrosMotor, "usarNotasIA">, fecha: string): string {
  const partes: string[] = [segmentoDe(r)];
  const u = params.usarNotasIA ? r.senales?.urgencia : undefined;
  if (u === "alta") partes.push("urgente");
  else if (u === "baja") partes.push("poca prioridad");
  const dias = Math.max(0, diasEntre(r.fecha_creacion, fecha));
  partes.push(`${dias} ${dias === 1 ? "día" : "días"} esperando`);
  return partes.join(", ");
}

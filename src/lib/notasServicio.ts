import { db } from "./db";
import { MODELO_NOTAS, PROMPT_NOTAS_VERSION, clasificarNota, type SenalesNota } from "./notas";

export interface LecturaDeNotas {
  mapa: Map<string, SenalesNota>;
  avisos: string[];
  distintas: number;
  /** Cuántas hubo que consultar al modelo (el resto salió del caché). */
  nuevas: number;
}

const CONCURRENCIA = 5;

/**
 * Devuelve la lectura de cada texto de nota distinto. Primero busca en el caché (tabla notas_senales); solo
 * las notas que no están se mandan al modelo, y luego se guardan. Si algo falla (sin tabla, sin saldo, sin key),
 * no se detiene el reparto: se devuelve lo que se pudo leer y un aviso para la consola.
 */
export async function leerSenales(textos: (string | null | undefined)[]): Promise<LecturaDeNotas> {
  const distintos = [...new Set(textos.map((t) => t?.trim()).filter((t): t is string => !!t))];
  const mapa = new Map<string, SenalesNota>();
  const avisos: string[] = [];
  if (!distintos.length) return { mapa, avisos, distintas: 0, nuevas: 0 };

  let cacheOk = true;
  const { data, error } = await db().from("notas_senales").select("texto,senales,prompt_version").in("texto", distintos);
  if (error) {
    cacheOk = false;
    avisos.push("No se pudo usar el caché de notas (¿falta crear la tabla notas_senales?). Las notas se leyeron sin guardarse.");
  } else {
    for (const f of (data ?? []) as unknown as { texto: string; senales: SenalesNota; prompt_version: string }[]) {
      if (f.prompt_version === PROMPT_NOTAS_VERSION) mapa.set(f.texto, f.senales);
    }
  }

  const faltan = distintos.filter((t) => !mapa.has(t));
  const nuevas: { texto: string; senales: SenalesNota; entrada: number; salida: number }[] = [];
  if (faltan.length && !process.env.ANTHROPIC_API_KEY) {
    avisos.push("Falta ANTHROPIC_API_KEY: no se pudieron leer las notas con IA; se aplicó solo la lectura por texto exacto.");
  } else {
    let fallos = 0, primerFallo = "";
    for (let i = 0; i < faltan.length; i += CONCURRENCIA) {
      const lote = faltan.slice(i, i + CONCURRENCIA);
      const res = await Promise.allSettled(lote.map((t) => clasificarNota(t)));
      res.forEach((r, j) => {
        if (r.status === "fulfilled") { mapa.set(lote[j], r.value.senales); nuevas.push({ texto: lote[j], senales: r.value.senales, entrada: r.value.entrada, salida: r.value.salida }); }
        else { fallos++; primerFallo ||= String((r.reason as Error)?.message ?? r.reason).slice(0, 160); }
      });
      if (fallos === lote.length && i === 0) break; // un fallo de cuenta o de red afecta a todas: no insistir
    }
    if (fallos) avisos.push(`No se pudieron leer ${fallos} nota(s) con IA (${primerFallo}). Esos registros se trataron sin lectura de nota.`);
  }

  if (cacheOk && nuevas.length) {
    const { error: e2 } = await db().from("notas_senales").upsert(nuevas.map((n) => ({
      texto: n.texto, senales: n.senales, modelo: MODELO_NOTAS, prompt_version: PROMPT_NOTAS_VERSION, entrada_tokens: n.entrada, salida_tokens: n.salida,
    })) as never, { onConflict: "texto" });
    if (e2) avisos.push("Se leyeron las notas pero no se pudieron guardar en el caché.");
  }
  return { mapa, avisos, distintas: distintos.length, nuevas: nuevas.length };
}

// Mide qué tan bien lee las notas cada modelo, contra las etiquetas de tests/etiquetas-notas.json.
//   npx tsx --env-file=.env.local scripts/evaluar-notas.mts [modelo1,modelo2,...]
// Cada modelo clasifica los 25 textos una vez. Cuesta centavos. No escribe en la base.
import { readFileSync } from "node:fs";
import { SENALES_NEUTRAS, clasificarNota, type SenalesNota } from "../src/lib/notas";

type Campo = Exclude<keyof SenalesNota, "razon">;
const CAMPOS: Campo[] = ["urgencia", "perfil_senior", "experto_sector", "necesidad_industrial", "recuperacion_cliente", "no_contactar", "dato_poco_confiable"];
const gold = JSON.parse(readFileSync("tests/etiquetas-notas.json", "utf8")) as {
  neutro: Omit<SenalesNota, "razon">; casos: { texto: string; real: boolean; esperado: Partial<SenalesNota> }[];
};
const esperado = (c: (typeof gold.casos)[number]) => ({ ...gold.neutro, ...c.esperado }) as Record<Campo, unknown>;
const PRECIO: Record<string, [number, number]> = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };
const modelos = (process.argv[2] ?? "claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5").split(",");

function puntuar(pred: (c: (typeof gold.casos)[number]) => Record<Campo, unknown>) {
  let ok = 0, tot = 0, exactos = 0, okReal = 0, totReal = 0, okNuevo = 0, totNuevo = 0, activadas = 0, esperadas = 0, activadasOk = 0;
  const fallas: string[] = [];
  for (const c of gold.casos) {
    const p = pred(c), e = esperado(c);
    let todo = true;
    for (const k of CAMPOS) {
      const bien = p[k] === e[k];
      tot++; if (bien) ok++; else { todo = false; fallas.push(`  "${c.texto.slice(0, 60)}" ${k}: pidió ${String(e[k])}, dio ${String(p[k])}`); }
      if (c.real) { totReal++; if (bien) okReal++; } else { totNuevo++; if (bien) okNuevo++; }
      // señales activas (true o urgencia distinta de normal): cuántas se detectan
      const act = (v: unknown) => v === true || v === "alta" || v === "baja";
      if (act(e[k])) { esperadas++; if (bien) activadasOk++; }
      if (act(p[k])) activadas++;
    }
    if (todo) exactos++;
  }
  return { acierto: ok / tot, exactos: `${exactos}/${gold.casos.length}`, real: okReal / totReal, nuevo: okNuevo / totNuevo, recall: activadasOk / (esperadas || 1), precision: activadasOk / (activadas || 1), fallas };
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
const fila = (n: string, r: ReturnType<typeof puntuar>, extra = "") =>
  console.log(`${n.padEnd(26)} acierto ${pct(r.acierto).padStart(4)} | notas exactas ${r.exactos.padStart(5)} | notas reales ${pct(r.real).padStart(4)} | redacciones nuevas ${pct(r.nuevo).padStart(4)} | señales detectadas ${pct(r.recall).padStart(4)} | precisión de lo marcado ${pct(r.precision).padStart(4)}${extra}`);

// Referencia: lo que hacía el código antes de la IA (texto exacto)
const regex = (c: (typeof gold.casos)[number]) => {
  const t = c.texto.toLowerCase();
  return { ...gold.neutro, perfil_senior: /senior/.test(t), experto_sector: /conozca el sector/.test(t), no_contactar: /no insistir/.test(t), dato_poco_confiable: /base comprada|posible duplicado/.test(t) } as Record<Campo, unknown>;
};
console.log(`${gold.casos.length} notas (${gold.casos.filter((c) => c.real).length} reales del archivo, ${gold.casos.filter((c) => !c.real).length} redacciones nuevas)\n`);
fila("Sin IA (texto exacto)", puntuar(regex));
fila("Todo neutro (no leer nada)", puntuar(() => ({ ...gold.neutro }) as Record<Campo, unknown>));

for (const m of modelos) {
  try {
    const lect = await Promise.all(gold.casos.map((c) => clasificarNota(c.texto, m)));
    const r = puntuar((c) => lect[gold.casos.indexOf(c)].senales as unknown as Record<Campo, unknown>);
    const [pi, po] = PRECIO[m] ?? [0, 0];
    const entrada = lect.reduce((a, l) => a + l.entrada, 0), salida = lect.reduce((a, l) => a + l.salida, 0);
    const costo = (entrada * pi + salida * po) / 1e6, seg = Math.max(...lect.map((l) => l.ms)) / 1000;
    fila(m, r, ` | US$${costo.toFixed(4)} en total (US$${(costo / gold.casos.length).toFixed(5)} por nota), ${seg.toFixed(1)} s la más lenta`);
    if (process.argv.includes("--fallas")) for (const f of r.fallas) console.log(f);
  } catch (e) {
    console.log(`${m.padEnd(26)} ERROR: ${(e as Error).message.slice(0, 200)}`);
  }
}
void SENALES_NEUTRAS;

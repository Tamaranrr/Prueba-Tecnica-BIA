// Prueba rápida del método de IA sin tocar la traza: npx tsx --env-file=.env.local scripts/probar-ia.mts [n]
import { armarLote, leerTodo } from "../src/lib/servicio";
import { proponerIA } from "../src/lib/ia";

const n = Number(process.argv[2] ?? 3);
const base = await leerTodo();
const { datos, params } = armarLote(base, { metodo: "ia", alcance: { tipo: "pendientes" }, fechaReferencia: "2026-09-30" });
const t0 = Date.now();
const r = await proponerIA(datos, params, n);
console.log(`${r.propuestas.length} propuestas en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const p of r.propuestas) {
  const reg = datos.registros.find((x) => x.id === p.registro_id)!;
  console.log(`\n#${reg.id} ${reg.razon_social} [${p.segmento}] zona ${reg.zona} | notas: ${reg.notas}`);
  console.log(`  → ${p.usuario_id} ${p.banderas_decision.join(",")} :: ${p.motivo}`);
}
console.log("\n--- PROMPT del primero ---\n" + r.propuestas[0].prompt_enviado);
console.log("\n--- RESPUESTA cruda ---\n" + r.propuestas[0].respuesta_modelo);

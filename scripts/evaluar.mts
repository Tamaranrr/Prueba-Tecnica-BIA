// Mide qué tan bien reparte cada método frente a cómo está hoy la operación, y prueba pesos alternativos.
//   npx tsx --env-file=.env.local scripts/evaluar.mts [fechaReferencia]
// Solo lee de la base: no escribe nada.
import { duenosActuales } from "../src/lib/engine/carga";
import { proponer } from "../src/lib/engine/motor";
import { segmentoDe } from "../src/lib/engine/segmento";
import type { ParametrosMotor, ResultadoMotor } from "../src/lib/engine/tipos";
import { armarLote, leerTodo } from "../src/lib/servicio";

const fecha = process.argv[2] ?? "2026-10-16";
const base = await leerTodo();
const usuarios = new Map(base.usuarios.map((u) => [u.id, u]));
const regs = new Map(base.registros.map((r) => [r.id, r]));
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");

// ───── Hoy: ¿cómo están repartidas las cuentas que ya se trabajan? ─────
const duenos = duenosActuales(base.actividad, base.vigentes);
const hist = base.registros.filter((r) => ["asignado", "en_gestion"].includes(r.estado) && duenos.has(r.id));
let seg = 0, zona = 0, grandesMal = 0, grandes = 0;
for (const r of hist) {
  const u = usuarios.get(duenos.get(r.id)!)!;
  if (u.segmento_experto === segmentoDe(r)) seg++;
  if (u.zona === r.zona) zona++;
  if (segmentoDe(r) === "corporativo") { grandes++; if (u.segmento_experto !== "corporativo") grandesMal++; }
}
console.log(`HOY (${hist.length} cuentas en trabajo): con experto de su segmento ${pct(seg, hist.length)} | en su zona ${pct(zona, hist.length)} | cuentas grandes sin experto corporativo ${grandesMal}/${grandes}\n`);

// ───── Métodos sobre los pendientes ─────
const vendedores = base.usuarios.filter((u) => u.rol === "vendedor" && u.activo && u.capacidad_maxima);
function metricas(res: ResultadoMotor) {
  const asig = res.propuestas.filter((p) => p.usuario_id !== null);
  let s = 0, z = 0, grandes = 0, grandesOk = 0, nuevos = 0;
  for (const p of asig) {
    const r = regs.get(p.registro_id)!, u = usuarios.get(p.usuario_id!)!;
    if (u.segmento_experto === p.segmento) s++;
    if (u.zona === r.zona) z++;
    if (p.segmento === "corporativo") { grandes++; if (u.segmento_experto === "corporativo") grandesOk++; }
    if (p.segmento === "corporativo" && u.fecha_ingreso && (Date.parse(fecha) - Date.parse(u.fecha_ingreso)) / 864e5 < res.parametros.pesos.diasMinCorporativo) nuevos++;
  }
  const ocup = vendedores.map((u) => (res.cargaFinal[u.id] ?? 0) / u.capacidad_maxima!);
  const media = ocup.reduce((a, b) => a + b, 0) / ocup.length;
  const desv = Math.sqrt(ocup.reduce((a, b) => a + (b - media) ** 2, 0) / ocup.length);
  return { asignados: asig.length, segmento: s / (asig.length || 1), zona: z / (asig.length || 1), grandes: `${grandesOk}/${grandes}`, grandesANuevos: nuevos, ocupMax: Math.max(...ocup), desv };
}
const fila = (n: string, m: ReturnType<typeof metricas>) =>
  console.log(`${n.padEnd(34)} asig ${String(m.asignados).padStart(2)} | seg ${pct(m.segmento * 100, 100).padStart(4)} | zona ${pct(m.zona * 100, 100).padStart(4)} | grandes c/experto ${m.grandes.padStart(5)} | grandes a <90d ${m.grandesANuevos} | ocup. máx ${Math.round(m.ocupMax * 100)}% | desv. ocup. ${(m.desv * 100).toFixed(1)} pts`);

const correr = (metodo: "round_robin" | "balanceo_carga" | "reglas", p: Partial<ParametrosMotor>) => {
  const l = armarLote(base, { metodo, alcance: { tipo: "pendientes" }, fechaReferencia: fecha, parametros: { zona: "estricta", ...p } });
  return proponer(metodo, l.datos, l.params);
};
console.log(`MÉTODOS sobre los pendientes (zona estricta)`);
for (const m of ["round_robin", "balanceo_carga", "reglas"] as const) fila(m, metricas(correr(m, {})));
console.log(`\nMÉTODOS con zona preferente (la zona suma puntos en vez de filtrar)`);
for (const m of ["round_robin", "balanceo_carga", "reglas"] as const) fila(m, metricas(correr(m, { zona: "preferente" })));

// ───── Sensibilidad de pesos del método de reglas (zona preferente) ─────
console.log(`\nSENSIBILIDAD DE PESOS (reglas, zona preferente), ordenado por segmento+zona, luego desviación`);
const filas: { n: string; m: ReturnType<typeof metricas> }[] = [];
for (const segmento of [0, 20, 40, 60]) for (const zonaP of [0, 20, 40]) for (const carga of [10, 30, 50]) {
  const m = metricas(correr("reglas", { zona: "preferente", pesos: { segmento, zona: zonaP, carga, antiguedad: 10, diasMinCorporativo: 90, aniosSenior: 2 } }));
  filas.push({ n: `seg ${segmento} zona ${zonaP} carga ${carga}`, m });
}
filas.sort((a, b) => (b.m.segmento + b.m.zona) - (a.m.segmento + a.m.zona) || a.m.desv - b.m.desv);
for (const f of [...filas.slice(0, 6), ...filas.filter((f) => f.n === "seg 40 zona 20 carga 30")]) fila(f.n, f.m);
console.log("...");
for (const f of filas.slice(-3)) fila(f.n, f.m);

// ───── Búsqueda fina (con la regla de cuentas grandes ya activa): pesos que ordenan por zona y luego por balance ─────
if (process.argv.includes("--fino")) {
  console.log(`
BÚSQUEDA FINA (zona preferente, grandes solo con expertos corporativos)`);
  const todas: { n: string; m: ReturnType<typeof metricas> }[] = [];
  for (const segmento of [10, 20, 30, 40, 50]) for (const zonaP of [10, 20, 30, 40, 50]) for (const carga of [20, 30, 40, 50, 60]) {
    const m = metricas(correr("reglas", { zona: "preferente", pesos: { segmento, zona: zonaP, carga, antiguedad: 10, diasMinCorporativo: 90, aniosSenior: 2 } }));
    todas.push({ n: `seg ${segmento} zona ${zonaP} carga ${carga}`, m });
  }
  todas.sort((a, b) => (b.m.segmento + b.m.zona) - (a.m.segmento + a.m.zona) || a.m.desv - b.m.desv);
  for (const f of todas.slice(0, 8)) fila(f.n, f.m);
  console.log("--- los mejores por balance con segmento y zona razonables (>= 70% y >= 70%)");
  for (const f of todas.filter((f) => f.m.segmento >= 0.7 && f.m.zona >= 0.7).sort((a, b) => a.m.desv - b.m.desv).slice(0, 6)) fila(f.n, f.m);
  console.log("--- defecto actual");
  for (const f of todas.filter((f) => f.n === "seg 40 zona 20 carga 30")) fila(f.n, f.m);
}

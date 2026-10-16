// Compara la asignación por IA con los métodos deterministas sobre los mismos pendientes.
//   npx tsx --env-file=.env.local scripts/evaluar-ia.mts [fecha] [repeticiones]
// Consulta al modelo una vez por registro (y otra vez para medir estabilidad): gasta saldo de API. No escribe en la base.
import { proponer } from "../src/lib/engine/motor";
import { segmentoDe, senalesNota } from "../src/lib/engine/segmento";
import type { Propuesta, ResultadoMotor } from "../src/lib/engine/tipos";
import { proponerIA, MODELO_IA } from "../src/lib/ia";
import { armarLote, leerTodo } from "../src/lib/servicio";

const fecha = process.argv[2] ?? "2026-10-16";
const repeticion = Number(process.argv[3] ?? 20);
const base = await leerTodo();
const usuarios = new Map(base.usuarios.map((u) => [u.id, u]));
const regs = new Map(base.registros.map((r) => [r.id, r]));
const vendedores = base.usuarios.filter((u) => u.rol === "vendedor" && u.activo && u.capacidad_maxima);
const dias = (u: { fecha_ingreso: string | null }) => (u.fecha_ingreso ? (Date.parse(fecha) - Date.parse(u.fecha_ingreso)) / 864e5 : 9999);
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");

function metricas(res: ResultadoMotor) {
  const asig = res.propuestas.filter((p) => p.usuario_id !== null);
  let seg = 0, zona = 0, gr = 0, grOk = 0, grNuevos = 0, sen = 0, senOk = 0, sec = 0, secOk = 0, respaldo = 0;
  for (const p of asig) {
    const r = regs.get(p.registro_id)!, u = usuarios.get(p.usuario_id!)!, n = senalesNota(r.notas);
    if (u.segmento_experto === p.segmento) seg++;
    if (u.zona === r.zona) zona++;
    if (p.segmento === "corporativo") { gr++; if (u.segmento_experto === "corporativo") grOk++; if (dias(u) < 90) grNuevos++; }
    if (n.pideSenior) { sen++; if (dias(u) / 365 >= 2) senOk++; }
    if (n.pideConocerSector) { sec++; if (u.segmento_experto === p.segmento) secOk++; }
    if (p.banderas_decision.includes("ia_respaldo")) respaldo++;
  }
  const ocup = vendedores.map((u) => (res.cargaFinal[u.id] ?? 0) / u.capacidad_maxima!);
  const media = ocup.reduce((a, b) => a + b, 0) / ocup.length;
  const desv = Math.sqrt(ocup.reduce((a, b) => a + (b - media) ** 2, 0) / ocup.length) * 100;
  return { n: asig.length, seg: pct(seg, asig.length), zona: pct(zona, asig.length), grandes: `${grOk}/${gr}`, grNuevos, senior: `${senOk}/${sen}`, sector: `${secOk}/${sec}`, ocupMax: `${Math.round(Math.max(...ocup) * 100)}%`, desv: desv.toFixed(1), respaldo };
}
const tabla = (nombre: string, m: ReturnType<typeof metricas>) =>
  console.log(`${nombre.padEnd(30)} asig ${String(m.n).padStart(2)} | segmento ${m.seg.padStart(4)} | zona ${m.zona.padStart(4)} | grandes c/experto ${m.grandes.padStart(5)} | grandes a <90d ${m.grNuevos} | nota senior ${m.senior.padStart(4)} | nota sector ${m.sector.padStart(4)} | ocup. máx ${m.ocupMax.padStart(4)} | desv ${m.desv.padStart(4)} | respaldo ${m.respaldo}`);

const lote = (metodo: "round_robin" | "balanceo_carga" | "reglas" | "ia", zona: "estricta" | "preferente") =>
  armarLote(base, { metodo, alcance: { tipo: "pendientes" }, fechaReferencia: fecha, parametros: { zona } });

console.log(`Modelo: ${MODELO_IA} | fecha ${fecha}\n`);
const det: Record<string, ResultadoMotor> = {};
for (const [m, z] of [["round_robin", "estricta"], ["balanceo_carga", "estricta"], ["reglas", "preferente"]] as const) {
  const l = lote(m, z); det[m] = proponer(m, l.datos, l.params);
}
const li = lote("ia", "preferente");
const t0 = Date.now();
const ia = await proponerIA(li.datos, li.params, 100);
const seg1 = (Date.now() - t0) / 1000;
const costo = (u: { entrada: number; salida: number }) => (u.entrada * 4 + u.salida * 20) / 1e6;

console.log("RESULTADOS sobre los mismos pendientes");
tabla("round_robin (zona estricta)", metricas(det.round_robin));
tabla("balanceo_carga (zona estricta)", metricas(det.balanceo_carga));
tabla("reglas (zona preferente)", metricas(det.reglas));
tabla("IA (zona preferente)", metricas(ia));
console.log(`\nIA: ${ia.uso.llamadas} llamadas, ${seg1.toFixed(0)} s (${(seg1 / ia.uso.llamadas).toFixed(1)} s por registro), ${ia.uso.entrada} tokens de entrada, ${ia.uso.salida} de salida, costo aprox. US$${costo(ia.uso).toFixed(3)} (US$${(costo(ia.uso) / ia.uso.llamadas).toFixed(4)} por registro)`);

// Acuerdo con el método de reglas
const porId = (r: ResultadoMotor) => new Map(r.propuestas.map((p) => [p.registro_id, p] as const));
const pr = porId(det.reglas), pi = porId(ia);
let igual = 0, total = 0, iaMejorSeg = 0, reglasMejorSeg = 0;
const difs: { id: number; ia: Propuesta; re: Propuesta }[] = [];
for (const [id, p] of pi) {
  const q = pr.get(id);
  if (!q || p.usuario_id === null || q.usuario_id === null) continue;
  total++;
  if (p.usuario_id === q.usuario_id) igual++;
  else {
    difs.push({ id, ia: p, re: q });
    const si = usuarios.get(p.usuario_id)!.segmento_experto === p.segmento, sr = usuarios.get(q.usuario_id)!.segmento_experto === p.segmento;
    if (si && !sr) iaMejorSeg++; if (sr && !si) reglasMejorSeg++;
  }
}
console.log(`\nACUERDO IA vs reglas: ${igual}/${total} (${pct(igual, total)}) eligieron al mismo vendedor. En los ${total - igual} distintos: la IA acierta el segmento y reglas no en ${iaMejorSeg}; reglas acierta y la IA no en ${reglasMejorSeg}.`);
for (const d of difs.slice(0, 4)) {
  const r = regs.get(d.id)!;
  console.log(`  #${d.id} ${r.razon_social} [${d.ia.segmento}] zona ${r.zona} | notas: ${r.notas ?? "(sin)"}\n    IA -> ${usuarios.get(d.ia.usuario_id!)!.nombre} (${usuarios.get(d.ia.usuario_id!)!.segmento_experto}, ${usuarios.get(d.ia.usuario_id!)!.zona})\n    reglas -> ${usuarios.get(d.re.usuario_id!)!.nombre} (${usuarios.get(d.re.usuario_id!)!.segmento_experto}, ${usuarios.get(d.re.usuario_id!)!.zona})`);
}

// Estabilidad: misma entrada, segunda corrida con los primeros N registros
if (repeticion > 0) {
  const ia2 = await proponerIA(li.datos, li.params, repeticion);
  let ig = 0;
  for (const p of ia2.propuestas) if (pi.get(p.registro_id)?.usuario_id === p.usuario_id) ig++;
  console.log(`\nESTABILIDAD: en ${ia2.propuestas.length} registros repetidos, la IA eligió al mismo vendedor ${ig}/${ia2.propuestas.length} (${pct(ig, ia2.propuestas.length)}). Costo de la repetición US$${costo(ia2.uso).toFixed(3)}`);
}

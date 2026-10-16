// Mide los cuatro métodos sobre los pendientes con las reglas finales y comprueba, con un cálculo independiente del motor,
// que ninguna regla dura se rompa. Solo lee de la base; el método de IA consulta al modelo (centavos con Haiku).
//   npx tsx --env-file=.env.local scripts/evaluar-plan.mts [fecha] [--sin-ia]
// Para que el resultado sea comparable, la base debe estar sin repartir (npm run reset).
import { antiguedadDe } from "../src/lib/engine/antiguedad";
import { ausenciaProxima, ausenciaVigente } from "../src/lib/engine/filtros";
import { proponer } from "../src/lib/engine/motor";
import { senalesNota, segmentoDe } from "../src/lib/engine/segmento";
import { PARAMETROS_DEFECTO, type Metodo, type ResultadoMotor } from "../src/lib/engine/tipos";
import { MODELO_IA, PROMPT_VERSION, proponerIA } from "../src/lib/ia";
import { leerSenales } from "../src/lib/notasServicio";
import { armarLote, fechaOperacion, leerTodo } from "../src/lib/servicio";

const base = await leerTodo();
const fecha = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : fechaOperacion(base);
const sinIA = process.argv.includes("--sin-ia");
const usuarios = new Map(base.usuarios.map((u) => [u.id, u]));
const regs = new Map(base.registros.map((r) => [r.id, r]));
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");

const sol = (metodo: Metodo) => ({ metodo, alcance: { tipo: "pendientes" as const }, fechaReferencia: fecha });
const lectura = await leerSenales(base.registros.filter((r) => r.estado === "nuevo").map((r) => r.notas));
const vendedores = base.usuarios.filter((u) => u.rol === "vendedor" && u.activo);

function medir(res: ResultadoMotor, perfilesIniciales: Record<number, { corporativo: number }>) {
  const asig = res.propuestas.filter((p) => p.usuario_id !== null);
  const c = { seg: 0, zona: 0, grandes: 0, grandesExp: 0, viol: 0, rampaNoPyme: 0, rampaRecibe: 0, urg: [] as number[], aus: 0, prox: 0, inact: 0, sinCap: 0, junior: 0 };
  const nuevasCorp: Record<number, number> = {};
  res.propuestas.forEach((p, pos) => {
    const r = regs.get(p.registro_id)!;
    if (p.usuario_id === null) return;
    const u = usuarios.get(p.usuario_id)!;
    const { nivel, dias } = antiguedadDe(u.fecha_ingreso, fecha);
    if (u.segmento_experto === p.segmento) c.seg++;
    if (u.zona === r.zona) c.zona++;
    if (p.segmento === "corporativo") {
      c.grandes++; if (u.segmento_experto === "corporativo") c.grandesExp++;
      nuevasCorp[u.id] = (nuevasCorp[u.id] ?? 0) + 1;
      if (dias !== null && dias < PARAMETROS_DEFECTO.pesos.diasMinCorporativo) c.junior++;
    }
    // Reglas duras comprobadas por separado del motor
    if (ausenciaVigente(base.ausencias, u.id, fecha)) c.aus++;
    if (ausenciaProxima(base.ausencias, u.id, fecha, PARAMETROS_DEFECTO.ventanaAusenciaDias)) c.prox++;
    if (!u.activo) c.inact++;
    if (u.capacidad_maxima === null) c.sinCap++;
    if (nivel === "rampa") { c.rampaRecibe++; if (segmentoDe(r) !== "pyme") c.rampaNoPyme++; }
    if (p.senales?.urgencia === "alta") c.urg.push(pos);
    void senalesNota;
  });
  c.viol = c.aus + c.prox + c.inact + c.sinCap + c.rampaNoPyme + c.junior;
  const ocup = vendedores.filter((u) => (res.cargaFinal[u.id] !== undefined) && u.capacidad_maxima !== null).map((u) => {
    const cap = u.capacidad_maxima === 0 ? PARAMETROS_DEFECTO.capacidadRampa : (u.capacidad_maxima as number);
    return (res.cargaFinal[u.id] ?? 0) / cap;
  });
  const media = ocup.reduce((a, b) => a + b, 0) / ocup.length;
  const desv = Math.sqrt(ocup.reduce((a, b) => a + (b - media) ** 2, 0) / ocup.length) * 100;
  const maxCorp = Math.max(0, ...vendedores.map((u) => (perfilesIniciales[u.id]?.corporativo ?? 0) + (nuevasCorp[u.id] ?? 0)));
  const personasCorp = Object.keys(nuevasCorp).length;
  return { asig: asig.length, ret: res.retenidos.length, seg: pct(c.seg, asig.length), zona: pct(c.zona, asig.length), grandesExp: `${c.grandesExp}/${c.grandes}`, personasCorp, maxCorp, ocupMax: `${Math.round(Math.max(...ocup) * 100)}%`, desv: desv.toFixed(1), viol: c.viol, detalle: `ausentes ${c.aus}, ausencia próxima ${c.prox}, inactivos ${c.inact}, sin capacidad ${c.sinCap}, rampa en cuentas no pyme ${c.rampaNoPyme}, cuentas grandes a menos de 2 años ${c.junior}`, rampaRecibe: c.rampaRecibe };
}
const fila = (n: string, m: ReturnType<typeof medir>) =>
  console.log(`${n.padEnd(20)} asig ${String(m.asig).padStart(2)} ret ${String(m.ret).padStart(2)} | segmento ${m.seg.padStart(4)} | zona ${m.zona.padStart(4)} | grandes c/experto ${m.grandesExp.padStart(5)} | grandes repartidas entre ${m.personasCorp} personas, máx. ${m.maxCorp} por vendedor | ocup. máx ${m.ocupMax.padStart(4)} | desv ${m.desv.padStart(4)} | recién entrados reciben ${m.rampaRecibe} | VIOLACIONES ${m.viol}`);

console.log(`Fecha de operación ${fecha} | ${lectura.distintas} notas distintas (${lectura.nuevas} leídas ahora) ${lectura.avisos.join(" | ")}\n`);
const resultados: [string, ResultadoMotor, ReturnType<typeof medir>][] = [];
for (const m of ["round_robin", "balanceo_carga", "reglas"] as const) {
  const l = armarLote(base, sol(m), lectura.mapa);
  const res = proponer(m, l.datos, l.params);
  const med = medir(res, l.datos.perfiles ?? {});
  resultados.push([m, res, med]); fila(m, med);
}
if (!sinIA) {
  const l = armarLote(base, sol("ia"), lectura.mapa);
  const t0 = Date.now();
  const res = await proponerIA(l.datos, l.params, 100);
  const med = medir(res, l.datos.perfiles ?? {});
  fila(`ia (${MODELO_IA}, prompt ${PROMPT_VERSION})`, med);
  console.log(`   IA: ${res.uso.llamadas} llamadas, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${res.uso.entrada} tokens de entrada y ${res.uso.salida} de salida. Respaldos: ${res.propuestas.filter((p) => p.banderas_decision.includes("ia_respaldo")).length}`);
  resultados.push(["ia", res, med]);
}
console.log("\nDetalle de reglas duras (debe ser 0 en todo):");
for (const [n, , m] of resultados) console.log(`  ${n.padEnd(16)} ${m.detalle}`);

// Urgentes: posición en la cola con y sin lectura de notas
const sin = armarLote(base, { ...sol("reglas"), parametros: { usarNotasIA: false } }, lectura.mapa);
const rSin = proponer("reglas", sin.datos, sin.params);
const lCon = armarLote(base, sol("reglas"), lectura.mapa);
const rCon = proponer("reglas", lCon.datos, lCon.params);
const urgentes = rCon.propuestas.filter((p) => p.senales?.urgencia === "alta").map((p) => p.registro_id);
const pos = (r: ResultadoMotor) => urgentes.map((id) => r.propuestas.findIndex((p) => p.registro_id === id)).filter((x) => x >= 0);
const med = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : NaN);
console.log(`\nOrden de reparto: ${rCon.propuestas.map((p) => p.segmento[0]).join("")}  (c = corporativo, i = industrial, p = pyme)`);
console.log(`Urgentes (${urgentes.length}): posición media en la cola ${med(pos(rSin))} sin lectura de notas, ${med(pos(rCon))} con ella (de ${rCon.propuestas.length})`);

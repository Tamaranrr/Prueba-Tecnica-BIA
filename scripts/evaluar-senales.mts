// Qué cambia en el reparto cuando se usa la lectura de notas con IA (método reglas, mismos pendientes).
//   npx tsx --env-file=.env.local scripts/evaluar-senales.mts [fecha]
// Lee las notas (del caché o del modelo: centavos). No escribe asignaciones.
import { proponer } from "../src/lib/engine/motor";
import { marcasDeSenales } from "../src/lib/engine/senales";
import { armarLote, leerTodo } from "../src/lib/servicio";
import { leerSenales } from "../src/lib/notasServicio";
import { MODELO_NOTAS } from "../src/lib/notas";

const fecha = process.argv[2] ?? "2026-10-16";
const base = await leerTodo();
const usuarios = new Map(base.usuarios.map((u) => [u.id, u]));
const sol = { metodo: "reglas" as const, alcance: { tipo: "pendientes" as const }, fechaReferencia: fecha };
const anios = (id: number) => { const u = usuarios.get(id)!; return u.fecha_ingreso ? (Date.parse(fecha) - Date.parse(u.fecha_ingreso)) / (864e5 * 365) : 5; };

const lectura = await leerSenales(armarLote(base, sol).datos.registros.map((r) => r.notas));
console.log(`Notas: ${lectura.distintas} textos distintos, ${lectura.nuevas} leídos ahora con ${MODELO_NOTAS}. Avisos: ${lectura.avisos.join(" | ") || "ninguno"}\n`);

const sin = armarLote(base, { ...sol, parametros: { usarNotasIA: false } });
const con = armarLote(base, sol, lectura.mapa);
const rSin = proponer("reglas", sin.datos, sin.params), rCon = proponer("reglas", con.datos, con.params);
const porSin = new Map(rSin.propuestas.map((p, i) => [p.registro_id, { p, pos: i }] as const));
const porCon = new Map(rCon.propuestas.map((p, i) => [p.registro_id, { p, pos: i }] as const));
const regs = new Map(con.datos.registros.map((r) => [r.id, r]));

let cambian = 0;
for (const [id, a] of porSin) { const b = porCon.get(id); if (b && a.p.usuario_id !== b.p.usuario_id) cambian++; }
console.log(`Asignables: ${rSin.propuestas.length} sin lectura, ${rCon.propuestas.length} con lectura. Retenidos: ${rSin.retenidos.length} sin, ${rCon.retenidos.length} con.`);
console.log(`Registros que cambian de vendedor por usar la lectura: ${cambian} de ${rCon.propuestas.length} (${Math.round((100 * cambian) / rCon.propuestas.length)}%)\n`);

const con_senal = (f: (r: NonNullable<ReturnType<typeof regs.get>>) => boolean) => [...porCon.keys()].filter((id) => f(regs.get(id)!));
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");

const sen = con_senal((r) => !!r.senales?.perfil_senior || !!r.senales?.experto_sector);
const senOk = (m: typeof porSin) => sen.filter((id) => m.get(id)!.p.usuario_id !== null && anios(m.get(id)!.p.usuario_id!) >= 2).length;
console.log(`Perfil senior pedido (${sen.length} registros): con vendedor de 2+ años  sin lectura ${pct(senOk(porSin), sen.length)} | con lectura ${pct(senOk(porCon), sen.length)}`);

const ind = con_senal((r) => !!r.senales?.necesidad_industrial && con.datos.registros.includes(r));
const indOk = (m: typeof porSin) => ind.filter((id) => usuarios.get(m.get(id)!.p.usuario_id ?? -1)?.segmento_experto === "industrial").length;
console.log(`Necesidad industrial (${ind.length} registros): a un experto industrial  sin lectura ${pct(indOk(porSin), ind.length)} | con lectura ${pct(indOk(porCon), ind.length)}`);

const baja = con_senal((r) => r.senales?.urgencia === "baja");
const antig = (m: typeof porSin) => media(baja.filter((id) => m.get(id)!.p.usuario_id !== null).map((id) => anios(m.get(id)!.p.usuario_id!)));
console.log(`Poco prioritarias (${baja.length} registros): antigüedad media del vendedor  sin lectura ${antig(porSin).toFixed(1)} años | con lectura ${antig(porCon).toFixed(1)} años`);

const alta = con_senal((r) => r.senales?.urgencia === "alta");
const pos = (m: typeof porSin) => media(alta.map((id) => m.get(id)!.pos));
console.log(`Urgentes (${alta.length} registros): posición media en la cola de ${rCon.propuestas.length}  sin lectura ${pos(porSin).toFixed(0)} | con lectura ${pos(porCon).toFixed(0)} (menor = antes)`);

const reten = rCon.retenidos.filter((x) => x.razones.includes("nota_no_contactar"));
console.log(`Retenidos solo por la lectura de la nota (pidió no ser contactado): ${reten.length}`);

console.log("\nLecturas más frecuentes:");
const cuenta = new Map<string, number>();
for (const r of regs.values()) if (r.senales) { const k = `urgencia ${r.senales.urgencia}${marcasDeSenales(r.senales).length ? ", " + marcasDeSenales(r.senales).join(", ") : ""}`; cuenta.set(k, (cuenta.get(k) ?? 0) + 1); }
for (const [k, n] of [...cuenta].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);

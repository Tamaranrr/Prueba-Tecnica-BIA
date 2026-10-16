import { test } from "node:test";
import assert from "node:assert/strict";
import { explicarAsignacion } from "../src/lib/engine/explicar";
import { parametros, type DatosMotor } from "../src/lib/engine/motor";
import { compararPrioridad, razonPrioridad } from "../src/lib/engine/prioridad";
import type { EvaluacionCandidato, Registro, Usuario } from "../src/lib/engine/tipos";
import { proponerIATodo, type Consultar } from "../src/lib/ia";

const HOY = "2026-10-16";
const u = (id: number, p: Partial<Usuario> = {}): Usuario => ({
  id, nombre: `V${id}`, rol: "vendedor", equipo_id: 1, zona: "Centro", segmento_experto: "pyme",
  capacidad_maxima: 10, fecha_ingreso: "2020-01-01", activo: true, banderas: [], ...p,
});
const r = (id: number, p: Partial<Registro> = {}): Registro => ({
  id, razon_social: `Empresa ${id}`, nit: `${id}`, sector: "Retail", empleados: 20, ingresos_estimados: (p.empleados ?? 20) >= 300 ? 50_000_000_000 : 1_000_000_000,
  ciudad: "Bogotá", zona: "Centro", fuente: "web", notas: null, estado: "nuevo", fecha_creacion: "2026-09-01",
  duplicado_de: null, banderas: [], ...p,
});
const datos = (usuarios: Usuario[], registros: Registro[]): DatosMotor => ({ usuarios, registros, ausencias: [], cargaInicial: {} });

/** Modelo falso: lee los ids de los candidatos del mensaje y elige según la regla dada. */
const modelo = (elegir: (ids: number[]) => number): Consultar => async (_sistema, mensaje) => {
  const ids = [...mensaje.matchAll(/^- id (\d+) \|/gm)].map((m) => Number(m[1]));
  const usuario_id = elegir(ids);
  return { parsed: { usuario_id, razon: "decisión de prueba" }, cruda: JSON.stringify({ usuario_id }), refusal: false, uso: { entrada: 100, salida: 20 } };
};
const siempreElPrimero = modelo((ids) => ids[0]);

test("olas: procesa TODOS los registros y ninguna decisión simultánea supera el cupo", async () => {
  const usuarios = [u(1, { capacidad_maxima: 3 }), u(2, { capacidad_maxima: 3 }), u(3, { capacidad_maxima: 3 })];
  const regs = Array.from({ length: 9 }, (_, i) => r(i + 1));
  // el modelo elige siempre al primero de la lista: en una ola de 4, varios chocarían con el cupo del vendedor 1
  const res = await proponerIATodo(datos(usuarios, regs), parametros(HOY), { ola: 4, consultar: siempreElPrimero });
  assert.equal(res.propuestas.length, 9);
  assert.equal(res.sin_procesar, 0);
  for (const id of [1, 2, 3]) assert.ok(res.propuestas.filter((p) => p.usuario_id === id).length <= 3, `el vendedor ${id} pasó su cupo`);
  assert.equal(res.propuestas.filter((p) => p.usuario_id !== null).length, 9);
  assert.equal(res.cargaFinal[1] + res.cargaFinal[2] + res.cargaFinal[3], 9);
});

test("olas: un choque se vuelve a consultar con el estado nuevo antes de usar el respaldo", async () => {
  const usuarios = [u(1, { capacidad_maxima: 1 }), u(2, { capacidad_maxima: 5 })];
  let llamadas = 0;
  const contador: Consultar = async (s, m) => { llamadas++; return siempreElPrimero(s, m); };
  const res = await proponerIATodo(datos(usuarios, [r(1), r(2), r(3)]), parametros(HOY), { ola: 3, consultar: contador });
  assert.equal(res.propuestas.filter((p) => p.usuario_id === 1).length, 1);
  assert.equal(res.propuestas.filter((p) => p.usuario_id === 2).length, 2);
  assert.equal(res.propuestas.filter((p) => p.banderas_decision.includes("ia_respaldo")).length, 0);
  assert.ok(llamadas > 3, "los registros que chocaron debieron consultarse otra vez");
});

test("olas: la ola 1 es secuencial, nunca choca y consulta una sola vez por registro", async () => {
  const usuarios = [u(1, { capacidad_maxima: 2 }), u(2), u(3)];
  const regs = Array.from({ length: 6 }, (_, i) => r(i + 1));
  let llamadas = 0;
  const contador: Consultar = async (s, m) => { llamadas++; return siempreElPrimero(s, m); };
  const res = await proponerIATodo(datos(usuarios, regs), parametros(HOY), { ola: 1, consultar: contador });
  assert.equal(llamadas, 6);                                                        // sin reintentos: cada decisión ve la anterior
  assert.equal(res.propuestas.filter((p) => p.usuario_id === 1).length, 2);         // el vendedor 1 se llena y la 3.ª elección ya no lo ve
  assert.equal(res.propuestas.filter((p) => p.banderas_decision.includes("ia_respaldo")).length, 0);
});

test("olas: una respuesta fuera de la lista usa el respaldo y queda marcada", async () => {
  const usuarios = [u(1), u(2)];
  const res = await proponerIATodo(datos(usuarios, [r(1), r(2)]), parametros(HOY), { ola: 2, consultar: modelo(() => 999) });
  assert.equal(res.propuestas.length, 2);
  assert.ok(res.propuestas.every((p) => p.usuario_id !== null && p.banderas_decision.includes("ia_respaldo")));
  assert.match(res.propuestas[0].motivo, /que no estaba entre los candidatos/);
});

test("olas: el progreso llega a total y los resultados salen en orden de prioridad", async () => {
  const usuarios = [u(1, { segmento_experto: "corporativo" }), u(2), u(3)];
  const regs = [r(1), r(2, { sector: "Textil" }), r(3, { empleados: 900 }), r(4)];
  const avances: number[] = [];
  const res = await proponerIATodo(datos(usuarios, regs), parametros(HOY), { ola: 3, consultar: siempreElPrimero, alAvanzar: (h, t) => { avances.push(h); assert.equal(t, 4); } });
  assert.equal(avances.at(-1), 4);
  assert.equal(avances.length, 4);
  assert.deepEqual(res.propuestas.map((p) => p.segmento), ["corporativo", "industrial", "pyme", "pyme"]);
});

test("olas: respeta el tope de cuentas grandes aunque el modelo siempre elija al mismo experto", async () => {
  const usuarios = [u(1, { segmento_experto: "corporativo" }), u(2, { segmento_experto: "corporativo" }), u(3)];
  const regs = Array.from({ length: 8 }, (_, i) => r(i + 1, { empleados: 900 }));
  const res = await proponerIATodo(datos(usuarios, regs), parametros(HOY, { topeGrandes: 3 }), { ola: 4, consultar: siempreElPrimero });
  for (const id of [1, 2, 3]) assert.ok(res.propuestas.filter((p) => p.usuario_id === id).length <= 3, `el vendedor ${id} pasó el tope`);
  assert.equal(res.propuestas.filter((p) => p.usuario_id !== null).length, 8);
});

test("olas: cada propuesta guarda el prompt que vio el modelo", async () => {
  const res = await proponerIATodo(datos([u(1), u(2)], [r(1), r(2)]), parametros(HOY), { ola: 2, consultar: siempreElPrimero });
  for (const p of res.propuestas) {
    assert.match(p.prompt_enviado ?? "", /<candidatos>/);
    assert.match(p.prompt_enviado ?? "", /cartera:/);
  }
});

// ───── prioridad ─────
test("prioridad: segmento, luego urgencia de la nota, luego quien más espera", () => {
  const senal = (urgencia: "alta" | "normal" | "baja") => ({ urgencia, perfil_senior: false, experto_sector: false, necesidad_industrial: false, recuperacion_cliente: false, no_contactar: false, dato_poco_confiable: false, razon: "" });
  const regs = [
    r(1, { fecha_creacion: "2026-09-01" }),                                              // pyme muy antigua
    r(2, { empleados: 900, fecha_creacion: "2026-09-20", senales: senal("baja") }),      // corporativa poco prioritaria
    r(3, { empleados: 900, fecha_creacion: "2026-09-25", senales: senal("alta") }),      // corporativa urgente
    r(4, { sector: "Textil", fecha_creacion: "2026-09-10" }),                            // industrial
  ];
  const orden = [...regs].sort(compararPrioridad({ ordenSegmentos: ["corporativo", "industrial", "pyme"], usarNotasIA: true })).map((x) => x.id);
  assert.deepEqual(orden, [3, 2, 4, 1]);
  const sinNotas = [...regs].sort(compararPrioridad({ ordenSegmentos: ["corporativo", "industrial", "pyme"], usarNotasIA: false })).map((x) => x.id);
  assert.deepEqual(sinNotas, [2, 3, 4, 1]);        // sin lectura de notas, manda quien lleva más esperando
  assert.match(razonPrioridad(regs[2], { usarNotasIA: true }, "2026-09-27"), /corporativo, urgente, 2 días esperando/);
});

// ───── explicación en lenguaje simple ─────
const cand = (id: number, carga: number, cap: number, extra: Partial<EvaluacionCandidato> = {}): EvaluacionCandidato =>
  ({ usuario_id: id, nombre: `V${id}`, elegible: true, descartes: [], carga, capacidad: cap, ...extra });

test("explicar: balanceo de carga dice cuánta carga tenía frente a los demás", () => {
  const t = explicarAsignacion({ metodo: "balanceo_carga", motivo: "x", usuario_id: 1, candidatos: [cand(1, 3, 40), cand(2, 20, 40), cand(3, 30, 40)] });
  assert.match(t, /3 de 40 cuentas \(8 %\)/);
  assert.match(t, /menos que otros 2 de los 3/);
});
test("explicar: reglas traduce el puntaje a razones", () => {
  const t = explicarAsignacion({
    metodo: "reglas", usuario_id: 1, motivo: "Reglas: cuenta corporativo; 140 pts; cuenta corporativa: solo compiten expertos corporativos.",
    candidatos: [cand(1, 4, 35, { desglose: { segmento: 30, zona: 30, carga: 53, antiguedad: 20, balance_grandes: 15 }, cartera: { nivel: "senior", antiguedadDias: 2000, antiguedadEstimada: false, cuentas: 4, corporativo: 2, industrial: 1, pyme: 1, ingresos: 0, acciones14d: 0, diasDesdeUltima: null, frias: 0 } }), cand(2, 20, 35)],
  });
  assert.match(t, /^Se le asignó porque /);
  assert.match(t, /experto en el tipo de cuenta/);
  assert.match(t, /misma zona/);
  assert.match(t, /pocas cuentas grandes \(2\)/);
  assert.match(t, /expertos corporativos/);
  assert.ok(!/pts|desglose|puntaje/.test(t), "no debe mostrar puntajes");
});
test("explicar: la IA muestra su razón sin el prefijo técnico y la reasignación manual conserva su motivo", () => {
  assert.equal(explicarAsignacion({ metodo: "ia", usuario_id: 1, motivo: "IA (claude-haiku-5-5): Es la experta de la zona. [cuenta corporativa: solo compiten expertos corporativos]", candidatos: null }), "Es la experta de la zona.");
  assert.match(explicarAsignacion({ metodo: "ia", usuario_id: 1, motivo: "Respaldo por balanceo de carga: x. y", candidatos: null }), /no pudo decidir/);
  // una razón larga se recorta al final de una frase, no a la mitad
  const larga = "Es la experta de la zona y tiene carga baja. " + "Además conoce el sector desde hace años y ha atendido cuentas parecidas con buenos resultados. ".repeat(4);
  const corta = explicarAsignacion({ metodo: "ia", usuario_id: 1, motivo: `IA (modelo): ${larga}`, candidatos: null });
  assert.ok(corta.length <= 240 && corta.endsWith("."), corta);
  assert.equal(explicarAsignacion({ metodo: "manual", usuario_id: 1, motivo: "Reasignación manual: el cliente lo pidió", candidatos: null }), "Reasignación manual: el cliente lo pidió");
});

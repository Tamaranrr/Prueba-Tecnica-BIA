import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularCarga } from "../src/lib/engine/carga";
import { proponer, parametros, type DatosMotor } from "../src/lib/engine/motor";
import { marcarDuplicadosEnTrabajo } from "../src/lib/engine/duplicados";
import { segmentoDe } from "../src/lib/engine/segmento";
import type { Ausencia, Registro, Usuario } from "../src/lib/engine/tipos";

const HOY = "2026-10-16";

const u = (id: number, p: Partial<Usuario> = {}): Usuario => ({
  id, nombre: `V${id}`, rol: "vendedor", equipo_id: 1, zona: "Centro", segmento_experto: "pyme",
  capacidad_maxima: 10, fecha_ingreso: "2020-01-01", activo: true, banderas: [], ...p,
});
const r = (id: number, p: Partial<Registro> = {}): Registro => ({
  id, razon_social: `Empresa ${id}`, nit: `${id}`, sector: "Retail", empleados: 20, ingresos_estimados: 1_000_000_000,
  ciudad: "Bogotá", zona: "Centro", fuente: "web", notas: null, estado: "nuevo", fecha_creacion: "2026-09-01",
  duplicado_de: null, banderas: [], ...p,
});
const datos = (usuarios: Usuario[], registros: Registro[], extra: Partial<DatosMotor> = {}): DatosMotor =>
  ({ usuarios, registros, ausencias: [], cargaInicial: {}, ...extra });

// ───── carga ─────
test("carga: dueño = usuario de la última actividad, solo asignado/en_gestion", () => {
  const regs = [r(1, { estado: "en_gestion" }), r(2, { estado: "asignado" }), r(3, { estado: "descartado" }), r(4, { estado: "nuevo" })];
  const act = [
    { id: 1, registro_id: 1, usuario_id: 5, tipo: "llamada", fecha: "2026-03-01" },
    { id: 2, registro_id: 1, usuario_id: 6, tipo: "correo", fecha: "2026-04-01" }, // el último manda
    { id: 3, registro_id: 2, usuario_id: 5, tipo: "nota", fecha: "2026-03-02" },
    { id: 4, registro_id: 3, usuario_id: 5, tipo: "nota", fecha: "2026-03-02" },
  ];
  assert.deepEqual(calcularCarga(regs, act), { 5: 1, 6: 1 });
});
test("carga: una asignación vigente del motor manda sobre la actividad histórica", () => {
  const regs = [r(1, { estado: "asignado" })];
  const act = [{ id: 1, registro_id: 1, usuario_id: 5, tipo: "nota", fecha: "2026-03-02" }];
  assert.deepEqual(calcularCarga(regs, act, [{ registro_id: 1, usuario_id: 9 }]), { 9: 1 });
});

// ───── segmento ─────
test("segmento: grande por empleados o ingresos es corporativo; sector fabril es industrial", () => {
  assert.equal(segmentoDe({ empleados: 900, ingresos_estimados: 1, sector: "Retail" }), "corporativo");
  assert.equal(segmentoDe({ empleados: 10, ingresos_estimados: 40_000_000_000, sector: "Retail" }), "corporativo");
  assert.equal(segmentoDe({ empleados: 120, ingresos_estimados: 5_000_000_000, sector: "Textil" }), "industrial");
  assert.equal(segmentoDe({ empleados: null, ingresos_estimados: null, sector: null }), "pyme");
  // el hueco real de los datos: 260 empleados y 17.700 M es mediana; 420 empleados ya es del grupo grande
  assert.equal(segmentoDe({ empleados: 260, ingresos_estimados: 17_700_000_000, sector: "Retail" }), "pyme");
  assert.equal(segmentoDe({ empleados: 420, ingresos_estimados: 29_800_000_000, sector: "Retail" }), "corporativo");
  assert.equal(segmentoDe({ empleados: 55, ingresos_estimados: 18_476_000_000, sector: "Retail" }), "corporativo");
});

// ───── filtros duros (valen para los tres métodos) ─────
for (const metodo of ["round_robin", "balanceo_carga", "reglas"] as const) {
  test(`filtros duros [${metodo}]: nunca asigna a inactivo, ausente, sin capacidad, sin cupo, líder ni recién llegado`, () => {
    const usuarios = [
      u(1, { activo: false }),
      u(2),                                           // ausente
      u(3, { capacidad_maxima: null }),
      u(4, { capacidad_maxima: 0 }),
      u(5, { capacidad_maxima: 2 }),                  // sin cupo (carga 2)
      u(6, { rol: "lider" }),
      u(7, { fecha_ingreso: "2026-12-01" }),          // aún no ingresa
      u(8),                                           // el único válido
    ];
    const aus: Ausencia[] = [{ id: 1, usuario_id: 2, desde: "2026-10-01", hasta: null, motivo: "Incapacidad" }];
    const res = proponer(metodo, datos(usuarios, [r(1), r(2), r(3)], { ausencias: aus, cargaInicial: { 5: 2 } }), parametros(HOY));
    assert.ok(res.propuestas.every((p) => p.usuario_id === 8), res.propuestas.map((p) => p.usuario_id).join());
    const descartes = res.propuestas[0].candidatos.find((c) => c.usuario_id === 2)!.descartes;
    assert.ok(descartes[0].startsWith("ausente"));
  });
}

test("ausencia con fecha de fin ya vencida no descarta; vigente sí", () => {
  const aus: Ausencia[] = [{ id: 1, usuario_id: 1, desde: "2026-09-01", hasta: "2026-09-10", motivo: "Vacaciones" }];
  const d = datos([u(1)], [r(1)], { ausencias: aus });
  assert.equal(proponer("balanceo_carga", d, parametros(HOY)).propuestas[0].usuario_id, 1);
  assert.equal(proponer("balanceo_carga", d, parametros("2026-09-05")).propuestas[0].usuario_id, null);
});

test("el lote nunca supera la capacidad aunque haya más registros que cupo", () => {
  const usuarios = [u(1, { capacidad_maxima: 2 }), u(2, { capacidad_maxima: 1 })];
  const res = proponer("round_robin", datos(usuarios, [r(1), r(2), r(3), r(4), r(5)]), parametros(HOY));
  const asignados = res.propuestas.filter((p) => p.usuario_id !== null);
  assert.equal(asignados.length, 3);
  assert.equal(res.propuestas.filter((p) => p.usuario_id === null).length, 2);
  assert.ok(res.cargaFinal[1] <= 2 && res.cargaFinal[2] <= 1);
});

// ───── retención ─────
test("registros duplicados o que pidieron no insistir quedan retenidos, no asignados", () => {
  const regs = [r(1), r(2, { duplicado_de: 1 }), r(3, { banderas: ["pidio_no_insistir"] }), r(4, { estado: "en_gestion" })];
  const res = proponer("balanceo_carga", datos([u(1)], regs), parametros(HOY));
  assert.deepEqual(res.propuestas.map((p) => p.registro_id), [1]);
  assert.deepEqual(res.retenidos.map((x) => x.registro_id).sort(), [2, 3, 4]);
});

// ───── zona ─────
test("zona estricta: solo vendedores de la zona; si no hay, desborda y lo deja anotado", () => {
  const usuarios = [u(1, { zona: "Costa" }), u(2, { zona: "Centro" })];
  const res = proponer("balanceo_carga", datos(usuarios, [r(1, { zona: "Costa" }), r(2, { zona: "Antioquia" })]), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 1);
  assert.deepEqual(res.propuestas[0].banderas_decision, []);
  assert.deepEqual(res.propuestas[1].banderas_decision, ["desborde_zona"]);
  assert.match(res.propuestas[1].motivo, /desbord/);
  const sin = proponer("balanceo_carga", datos(usuarios, [r(1, { zona: "Antioquia" })]), parametros(HOY, { desbordarSiNoHay: false }));
  assert.equal(sin.propuestas[0].usuario_id, null);
});

// ───── método 1: round-robin ponderado ─────
test("round-robin: reparte en proporción al cupo libre", () => {
  const usuarios = [u(1, { capacidad_maxima: 30 }), u(2, { capacidad_maxima: 10 })];
  const regs = Array.from({ length: 8 }, (_, i) => r(i + 1));
  const res = proponer("round_robin", datos(usuarios, regs), parametros(HOY));
  const n1 = res.propuestas.filter((p) => p.usuario_id === 1).length;
  assert.equal(n1, 6); // 30:10 = 3:1 → 6 de 8
});
test("round-robin es determinista", () => {
  const usuarios = [u(1), u(2), u(3)];
  const regs = Array.from({ length: 6 }, (_, i) => r(i + 1));
  const a = proponer("round_robin", datos(usuarios, regs), parametros(HOY)).propuestas.map((p) => p.usuario_id);
  const b = proponer("round_robin", datos(usuarios, regs), parametros(HOY)).propuestas.map((p) => p.usuario_id);
  assert.deepEqual(a, b);
});

// ───── método 2: balanceo de carga ─────
test("balanceo: el recién llegado con 1 se pone al día antes que el que ya tiene 200", () => {
  const usuarios = [u(1, { capacidad_maxima: 300 }), u(2, { capacidad_maxima: 300 })];
  const res = proponer("balanceo_carga", datos(usuarios, Array.from({ length: 10 }, (_, i) => r(i + 1)), { cargaInicial: { 1: 200, 2: 1 } }), parametros(HOY));
  assert.ok(res.propuestas.every((p) => p.usuario_id === 2));
});
test("balanceo: iguala la ocupación relativa, no el conteo bruto", () => {
  const usuarios = [u(1, { capacidad_maxima: 40 }), u(2, { capacidad_maxima: 10 })];
  const res = proponer("balanceo_carga", datos(usuarios, Array.from({ length: 10 }, (_, i) => r(i + 1))), parametros(HOY));
  assert.equal(res.cargaFinal[1], 8);
  assert.equal(res.cargaFinal[2], 2);
});

// ───── método 3: reglas ─────
test("reglas: la cuenta grande va a un experto corporativo, no al de pyme con menos carga", () => {
  const usuarios = [u(1, { segmento_experto: "pyme" }), u(2, { segmento_experto: "corporativo" })];
  const res = proponer("reglas", datos(usuarios, [r(1, { empleados: 900 })], { cargaInicial: { 2: 5 } }), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 2);
  assert.equal(res.propuestas[0].segmento, "corporativo");
  assert.ok(res.propuestas[0].candidatos.find((c) => c.usuario_id === 2)!.desglose!.segmento > 0);
});
test("reglas: una cuenta corporativa no va a un vendedor con menos de 90 días", () => {
  const usuarios = [u(1, { segmento_experto: "corporativo", fecha_ingreso: "2026-09-20" }), u(2, { segmento_experto: "pyme" })];
  const res = proponer("reglas", datos(usuarios, [r(1, { empleados: 900 })]), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 2);
});
test("reglas: la nota 'alguien senior' se respeta y queda explicada", () => {
  const usuarios = [u(1, { fecha_ingreso: "2026-03-01" }), u(2, { fecha_ingreso: "2019-01-01" })];
  const res = proponer("reglas", datos(usuarios, [r(1, { notas: "Insistió en hablar con alguien senior." })]), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 2);
  assert.match(res.propuestas[0].motivo, /senior/);
});
test("reglas: cada propuesta guarda el desglose de todos los candidatos evaluados", () => {
  const res = proponer("reglas", datos([u(1), u(2, { activo: false })], [r(1)]), parametros(HOY));
  const c = res.propuestas[0].candidatos;
  assert.equal(c.length, 2);
  assert.ok(c[0].desglose && c[0].puntaje !== undefined);
  assert.deepEqual(c[1].descartes, ["inactivo"]);
});
test("reglas: los pesos se pueden configurar", () => {
  const usuarios = [u(1, { segmento_experto: "pyme", zona: "Centro" }), u(2, { segmento_experto: "industrial", zona: "Costa" })];
  const regs = [r(1, { zona: "Centro", sector: "Textil", empleados: 100 })]; // industrial
  const base = parametros(HOY, { zona: "preferente" });
  assert.equal(proponer("reglas", datos(usuarios, regs), { ...base, pesos: { ...base.pesos, segmento: 5, zona: 50 } }).propuestas[0].usuario_id, 1);
  assert.equal(proponer("reglas", datos(usuarios, regs), { ...base, pesos: { ...base.pesos, segmento: 80, zona: 5 } }).propuestas[0].usuario_id, 2);
});

// ───── duplicados con gemelo ya trabajado ─────
test("un nuevo cuyo gemelo ya está en gestión o descartado se retiene; si el gemelo también es nuevo, no", () => {
  const todos = [
    r(1), r(2, { duplicado_de: 1, estado: "en_gestion" }),                // 1 es nuevo y su duplicado ya se trabaja
    r(3), r(4, { duplicado_de: 3, estado: "nuevo" }),                     // ambos nuevos
    r(5), r(6, { duplicado_de: 5, estado: "descartado" }),                // el gemelo se descartó
    r(7),                                                                 // sin gemelo
  ];
  const lote = marcarDuplicadosEnTrabajo(todos.filter((x) => x.estado === "nuevo"), todos);
  const res = proponer("balanceo_carga", datos([u(1)], lote), parametros(HOY));
  assert.deepEqual(res.retenidos.map((x) => x.registro_id).sort((a, b) => a - b), [1, 4, 5]);
  assert.deepEqual(res.propuestas.map((p) => p.registro_id).sort((a, b) => a - b), [3, 7]);
  assert.ok(res.retenidos.find((x) => x.registro_id === 1)!.razones[0].startsWith("duplicado_en_en_gestion"));
  assert.equal(todos[0].banderas.length, 0); // no muta lo recibido
});

// ───── cuentas grandes: regla explícita ─────
test("reglas: una cuenta corporativa solo compite entre expertos corporativos, aunque otro tenga menos carga", () => {
  const usuarios = [u(1, { segmento_experto: "pyme" }), u(2, { segmento_experto: "corporativo" })];
  const res = proponer("reglas", datos(usuarios, [r(1, { empleados: 420 })], { cargaInicial: { 2: 9 } }), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 2);
  assert.match(res.propuestas[0].motivo, /solo compiten expertos corporativos/);
});
test("reglas: si no hay expertos corporativos disponibles, la cuenta grande la toma otro y queda dicho", () => {
  const usuarios = [u(1, { segmento_experto: "pyme" }), u(2, { segmento_experto: "corporativo", activo: false })];
  const res = proponer("reglas", datos(usuarios, [r(1, { empleados: 420 })]), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 1);
  assert.match(res.propuestas[0].motivo, /sin expertos corporativos disponibles/);
});
test("reglas: la regla de cuentas grandes se puede apagar", () => {
  const usuarios = [u(1, { segmento_experto: "pyme" }), u(2, { segmento_experto: "corporativo" })];
  const p = parametros(HOY, { grandesSoloExpertos: false, pesos: { segmento: 0, zona: 0, carga: 60, antiguedad: 0, diasMinCorporativo: 0, aniosSenior: 2 } });
  const res = proponer("reglas", datos(usuarios, [r(1, { empleados: 420 })], { cargaInicial: { 2: 9 } }), p);
  assert.equal(res.propuestas[0].usuario_id, 1);
});

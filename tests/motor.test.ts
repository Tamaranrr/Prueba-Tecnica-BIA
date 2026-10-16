import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularCarga, duenosActuales } from "../src/lib/engine/carga";
import { proponer, parametros, type DatosMotor } from "../src/lib/engine/motor";
import { marcarDuplicadosEnTrabajo } from "../src/lib/engine/duplicados";
import { antiguedadDe } from "../src/lib/engine/antiguedad";
import { calcularPerfiles, cuentasFrias } from "../src/lib/engine/cartera";
import { ausenciaProxima, capacidadEfectiva } from "../src/lib/engine/filtros";
import { segmentoDe } from "../src/lib/engine/segmento";
import type { Ausencia, Registro, Usuario } from "../src/lib/engine/tipos";

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
  const p = parametros(HOY, { grandesSoloExpertos: false, pesos: { segmento: 0, zona: 0, carga: 60, antiguedad: 0, cartera: 0, diasMinCorporativo: 0, aniosSenior: 2 } });
  const res = proponer("reglas", datos(usuarios, [r(1, { empleados: 420 })], { cargaInicial: { 2: 9 } }), p);
  assert.equal(res.propuestas[0].usuario_id, 1);
});

// ───── lectura de notas por IA (señales) ─────
const S = (p: Partial<NonNullable<Registro["senales"]>> = {}): NonNullable<Registro["senales"]> => ({
  urgencia: "normal", perfil_senior: false, experto_sector: false, necesidad_industrial: false,
  recuperacion_cliente: false, no_contactar: false, dato_poco_confiable: false, razon: "prueba", ...p,
});

test("notas IA: lo urgente se atiende primero, aunque haya llegado después", () => {
  const regs = [r(1, { fecha_creacion: "2026-09-01" }), r(2, { fecha_creacion: "2026-09-20", senales: S({ urgencia: "alta" }) })];
  const res = proponer("balanceo_carga", datos([u(1, { capacidad_maxima: 1 })], regs), parametros(HOY));
  assert.equal(res.propuestas.find((p) => p.usuario_id === 1)!.registro_id, 2);
  assert.deepEqual(res.propuestas.map((p) => p.registro_id), [2, 1]);
});

test("notas IA: perfil senior leído de una redacción que el texto exacto no detecta", () => {
  const usuarios = [u(1, { fecha_ingreso: "2026-03-01" }), u(2, { fecha_ingreso: "2019-01-01" })];
  const reg = r(1, { notas: "Quiere un ejecutivo con trayectoria", senales: S({ perfil_senior: true }) });
  const carga = { cargaInicial: { 2: 3 } }; // el junior está menos cargado: sin la lectura, ganaría él
  assert.equal(proponer("reglas", datos(usuarios, [reg], carga), parametros(HOY)).propuestas[0].usuario_id, 2);
  const sin = proponer("reglas", datos(usuarios, [{ ...reg, senales: undefined }], carga), parametros(HOY));
  assert.equal(sin.propuestas[0].usuario_id, 1);
});

test("notas IA: necesidad industrial favorece al experto industrial en cuentas no corporativas", () => {
  const usuarios = [u(1, { segmento_experto: "pyme" }), u(2, { segmento_experto: "industrial" })];
  const reg = r(1, { senales: S({ necesidad_industrial: true }) });
  const res = proponer("reglas", datos(usuarios, [reg], { cargaInicial: { 1: 3 } }), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 2);
  assert.match(res.propuestas[0].motivo, /necesidad industrial/);
  const sin = proponer("reglas", datos(usuarios, [{ ...reg, senales: undefined }], { cargaInicial: { 1: 3 } }), parametros(HOY));
  assert.equal(sin.propuestas[0].usuario_id, 1);
});


test("notas IA: quien pidió no ser contactado se retiene aunque la nota no use las palabras exactas", () => {
  const res = proponer("balanceo_carga", datos([u(1)], [r(1, { senales: S({ no_contactar: true }) }), r(2)]), parametros(HOY));
  assert.deepEqual(res.retenidos.map((x) => [x.registro_id, x.razones[0]]), [[1, "nota_no_contactar"]]);
  assert.deepEqual(res.propuestas.map((p) => p.registro_id), [2]);
});

test("notas IA: con la opción apagada las señales no cambian nada", () => {
  const usuarios = [u(1, { fecha_ingreso: "2026-03-01" }), u(2, { fecha_ingreso: "2019-01-01" })];
  const con = [r(1, { fecha_creacion: "2026-09-01" }), r(2, { fecha_creacion: "2026-09-20", senales: S({ urgencia: "alta", perfil_senior: true, no_contactar: true }) })];
  const sin = con.map((x) => ({ ...x, senales: undefined }));
  const p = parametros(HOY, { usarNotasIA: false });
  const forma = (rs: Registro[]) => { const x = proponer("reglas", datos(usuarios, rs), p); return [x.propuestas.map((q) => [q.registro_id, q.usuario_id]), x.retenidos.length]; };
  assert.deepEqual(forma(con), forma(sin));
});

test("notas IA: la propuesta guarda la lectura usada, para la traza", () => {
  const res = proponer("balanceo_carga", datos([u(1)], [r(1, { senales: S({ urgencia: "alta" }) })]), parametros(HOY));
  assert.equal(res.propuestas[0].senales?.urgencia, "alta");
});

// ───── segmento: corporativo por ingresos, luego industrial por sector, luego pyme ─────
test("segmento: corporativo lo define el ingreso; el tamaño solo cuando falta el ingreso", () => {
  assert.equal(segmentoDe({ empleados: 10, ingresos_estimados: 40_000_000_000, sector: "Retail" }), "corporativo");
  assert.equal(segmentoDe({ empleados: 900, ingresos_estimados: null, sector: "Retail" }), "corporativo");   // sin ingreso: manda el tamaño
  assert.equal(segmentoDe({ empleados: 900, ingresos_estimados: 1_000_000_000, sector: "Retail" }), "pyme"); // contradicción: manda el ingreso
  assert.equal(segmentoDe({ empleados: null, ingresos_estimados: null, sector: null }), "pyme");
  // el hueco real de los datos: 260 empleados y 17.700 M es mediana; 420 empleados y 29.800 M ya es el grupo grande
  assert.equal(segmentoDe({ empleados: 260, ingresos_estimados: 17_700_000_000, sector: "Retail" }), "pyme");
  assert.equal(segmentoDe({ empleados: 420, ingresos_estimados: 29_800_000_000, sector: "Retail" }), "corporativo");
});
test("segmento: una empresa grande de sector fabril es corporativa; una pequeña del mismo sector es industrial", () => {
  assert.equal(segmentoDe({ empleados: 100, ingresos_estimados: 60_000_000_000, sector: "Textil" }), "corporativo");
  assert.equal(segmentoDe({ empleados: 100, ingresos_estimados: 3_000_000_000, sector: "Textil" }), "industrial");
  assert.equal(segmentoDe({ empleados: 100, ingresos_estimados: 3_000_000_000, sector: "Tecnología" }), "pyme");
});

test("orden de reparto: corporativo, industrial y pyme, sin importar quién llegó primero", () => {
  const regs = [
    r(1, { fecha_creacion: "2026-09-01" }),                                          // pyme, la más antigua
    r(2, { sector: "Textil", fecha_creacion: "2026-09-10" }),                        // industrial
    r(3, { empleados: 900, fecha_creacion: "2026-09-20" }),                          // corporativo, la más nueva
  ];
  const res = proponer("balanceo_carga", datos([u(1, { capacidad_maxima: 1, segmento_experto: "corporativo" }), u(2, { capacidad_maxima: 1 }), u(3, { capacidad_maxima: 1 })], regs), parametros(HOY));
  assert.deepEqual(res.propuestas.map((p) => p.registro_id), [3, 2, 1]);
  const inverso = proponer("balanceo_carga", datos([u(1)], regs), parametros(HOY, { ordenSegmentos: ["pyme", "industrial", "corporativo"] }));
  assert.deepEqual(inverso.propuestas.map((p) => p.registro_id), [1, 2, 3]);
});

// ───── fecha, ausencias próximas y capacidad provisional ─────
test("ausencia próxima: quien se ausenta dentro de la ventana no recibe cuentas; fuera de la ventana sí", () => {
  const aus: Ausencia[] = [{ id: 1, usuario_id: 1, desde: "2026-10-20", hasta: "2026-10-30", motivo: "Vacaciones" }];
  assert.ok(ausenciaProxima(aus, 1, "2026-10-16", 7));
  assert.equal(ausenciaProxima(aus, 1, "2026-10-16", 3), undefined);
  assert.equal(ausenciaProxima(aus, 1, "2026-10-16", 0), undefined);
  assert.equal(ausenciaProxima(aus, 1, "2026-10-20", 7), undefined); // ya empezó: es una ausencia vigente, no próxima
  const d = datos([u(1), u(2)], [r(1)], { ausencias: aus });
  const res = proponer("balanceo_carga", d, parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 2);
  assert.ok(res.propuestas[0].candidatos.find((c) => c.usuario_id === 1)!.descartes[0].startsWith("se_ausenta_el_2026-10-20"));
  assert.equal(proponer("balanceo_carga", d, parametros(HOY, { ventanaAusenciaDias: 3 })).propuestas[0].usuario_id, 1);
});

test("antigüedad: niveles rampa, junior, pleno y senior; sin fecha de ingreso se asume senior y queda marcado", () => {
  const f = "2026-10-16";
  assert.equal(antiguedadDe("2026-09-01", f).nivel, "rampa");
  assert.equal(antiguedadDe("2025-12-01", f).nivel, "junior");
  assert.equal(antiguedadDe("2023-10-30", f).nivel, "pleno");
  assert.equal(antiguedadDe("2020-01-01", f).nivel, "senior");
  assert.deepEqual(antiguedadDe(null, f), { nivel: "senior", dias: null, estimada: true });
});

test("recién entrado con capacidad 0: usa la provisional y solo recibe cuentas pyme", () => {
  const nuevo = { id: 7, fecha_ingreso: "2026-09-20", capacidad_maxima: 0 };
  assert.deepEqual(capacidadEfectiva(nuevo, HOY, 10), { capacidad: 10, provisional: true });
  assert.deepEqual(capacidadEfectiva(nuevo, HOY, 0), { capacidad: 0, provisional: false });
  assert.deepEqual(capacidadEfectiva({ ...nuevo, capacidad_maxima: null }, HOY, 10), { capacidad: null, provisional: false }); // sin dato no se inventa
  assert.deepEqual(capacidadEfectiva({ ...nuevo, fecha_ingreso: "2020-01-01" }, HOY, 10), { capacidad: 0, provisional: false }); // ya no está en rampa
  const rampa = u(7, { fecha_ingreso: "2026-09-20", capacidad_maxima: 0 });
  const res = proponer("balanceo_carga", datos([rampa], [r(1), r(2, { empleados: 900 }), r(3, { sector: "Textil" })]), parametros(HOY));
  const por = new Map(res.propuestas.map((p) => [p.registro_id, p]));
  assert.equal(por.get(1)!.usuario_id, 7);                       // pyme: sí
  assert.equal(por.get(2)!.usuario_id, null);                    // corporativa: no
  assert.equal(por.get(3)!.usuario_id, null);                    // industrial: no
  assert.match(por.get(2)!.candidatos[0].descartes[0], /en_rampa_solo_cuentas_pyme/);
  assert.equal(por.get(1)!.candidatos[0].capacidad_provisional, true);
  const sin = proponer("balanceo_carga", datos([rampa], [r(1)]), parametros(HOY, { capacidadRampa: 0 }));
  assert.equal(sin.propuestas[0].usuario_id, null);               // sin capacidad provisional vuelve a quedar excluido
});

test("la capacidad provisional también limita: no se supera", () => {
  const rampa = u(7, { fecha_ingreso: "2026-09-20", capacidad_maxima: 0 });
  const res = proponer("balanceo_carga", datos([rampa], Array.from({ length: 14 }, (_, i) => r(i + 1))), parametros(HOY));
  assert.equal(res.propuestas.filter((p) => p.usuario_id === 7).length, 10);
});

// ───── dueño actual, cartera y actividad ─────
test("nadie puede recibir su propio registro al reasignar", () => {
  const regs = [r(1, { estado: "en_gestion", dueno_actual: 1 }), r(2, { estado: "en_gestion", dueno_actual: 2 })];
  const res = proponer("balanceo_carga", datos([u(1), u(2)], regs), parametros(HOY, { estados: ["en_gestion"] }));
  const por = new Map(res.propuestas.map((p) => [p.registro_id, p.usuario_id]));
  assert.equal(por.get(1), 2);
  assert.equal(por.get(2), 1);
});

test("calcular carga cuenta los autoasignados como cartera viva", () => {
  const regs = [r(1, { estado: "autoasignado" }), r(2, { estado: "asignado" }), r(3, { estado: "nuevo" })];
  const vig = [{ registro_id: 1, usuario_id: 9 }, { registro_id: 2, usuario_id: 9 }, { registro_id: 3, usuario_id: 9 }];
  assert.deepEqual(calcularCarga(regs, [], vig), { 9: 2 });
});

test("cartera: cuentas por segmento, ingresos, actividad reciente y cuentas frías", () => {
  const regs = [
    r(1, { estado: "en_gestion", empleados: 900 }),                                  // corporativa (50.000 M)
    r(2, { estado: "autoasignado", sector: "Textil" }),                              // industrial (1.000 M)
    r(3, { estado: "asignado", fecha_creacion: "2026-07-01" }),                      // pyme, vieja y sin movimiento desde el 1 de agosto
    r(4, { estado: "descartado" }), r(5, { estado: "nuevo" }),                       // no cuentan
  ];
  const act = [
    { id: 1, registro_id: 1, usuario_id: 8, tipo: "llamada", fecha: "2026-09-25" },
    { id: 2, registro_id: 1, usuario_id: 8, tipo: "correo", fecha: "2026-09-20" },
    { id: 3, registro_id: 3, usuario_id: 8, tipo: "nota", fecha: "2026-08-01" },
  ];
  const duenos = duenosActuales(act, [{ registro_id: 2, usuario_id: 8 }]);
  const vig = [{ registro_id: 2, creada_en: "2026-09-26T10:00:00Z" }];
  const p = calcularPerfiles([{ id: 8, fecha_ingreso: "2023-05-02" }, { id: 9, fecha_ingreso: null }], regs, act, duenos, vig, "2026-09-27")[8];
  assert.deepEqual([p.cuentas, p.corporativo, p.industrial, p.pyme], [3, 1, 1, 1]);
  assert.equal(p.ingresos, 50_000_000_000 + 1_000_000_000 + 1_000_000_000);
  assert.equal(p.acciones14d, 2);              // 25 y 20 de sept están a menos de 14 días; el 1 de agosto no
  assert.equal(p.diasDesdeUltima, 2);
  assert.equal(p.frias, 1);                    // solo la cuenta 3 lleva más de 30 días sin movimiento
  assert.equal(p.nivel, "pleno");
  assert.equal(calcularPerfiles([{ id: 9, fecha_ingreso: null }], [], [], new Map(), [], "2026-09-27")[9].antiguedadEstimada, true);
  assert.deepEqual([...cuentasFrias(regs, act, vig, "2026-09-27")], [3]);
});

test("cartera: el motor la actualiza durante el lote y cada decisión deja la foto de lo que vio", () => {
  const perfiles = calcularPerfiles([{ id: 1, fecha_ingreso: "2020-01-01" }, { id: 2, fecha_ingreso: "2020-01-01" }], [], [], new Map(), [], HOY);
  const regs = [r(1, { empleados: 900 }), r(2, { empleados: 900 })];
  const res = proponer("balanceo_carga", datos([u(1), u(2)], regs, { perfiles }), parametros(HOY));
  const primera = res.propuestas[0].candidatos.find((c) => c.usuario_id === res.propuestas[0].usuario_id)!;
  assert.equal(primera.cartera?.corporativo, 0);
  const elegido2 = res.propuestas[1].candidatos.find((c) => c.usuario_id === res.propuestas[0].usuario_id)!;
  assert.equal(elegido2.cartera?.corporativo, 1);      // la segunda decisión ya vio la cuenta que se acababa de asignar
  assert.equal(perfiles[1].corporativo, 0);            // y el perfil original no se tocó
});

// ───── antigüedad y balance de cuentas grandes en el método de reglas ─────
test("reglas: una cuenta pyme sin más señales va al vendedor de menor nivel, para que se nivele", () => {
  const usuarios = [u(1, { fecha_ingreso: "2019-01-01" }), u(2, { fecha_ingreso: "2026-05-01" })];
  const res = proponer("reglas", datos(usuarios, [r(1)]), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 2);
});
test("reglas: una cuenta de poca prioridad va al de menos antigüedad; una industrial normal no favorece a nadie por nivel", () => {
  // El junior (2025) puede recibir cuentas industriales; uno en rampa solo recibiría pyme.
  const usuarios = [u(1, { fecha_ingreso: "2019-01-01", segmento_experto: "industrial" }), u(2, { fecha_ingreso: "2025-06-01", segmento_experto: "industrial" })];
  const industrial = r(1, { sector: "Textil" });
  assert.equal(proponer("reglas", datos(usuarios, [industrial]), parametros(HOY)).propuestas[0].usuario_id, 1);
  const baja = { ...industrial, senales: S({ urgencia: "baja" }) };
  assert.equal(proponer("reglas", datos(usuarios, [baja]), parametros(HOY)).propuestas[0].usuario_id, 2);
});
test("reglas: una cuenta corporativa favorece al de mayor nivel", () => {
  const usuarios = [u(1, { fecha_ingreso: "2024-01-01", segmento_experto: "corporativo" }), u(2, { fecha_ingreso: "2019-01-01", segmento_experto: "corporativo" })];
  const res = proponer("reglas", datos(usuarios, [r(1, { empleados: 900 })]), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 2);
});
test("reglas: reparte las cuentas grandes entre varios expertos en vez de concentrarlas", () => {
  const usuarios = [u(1, { segmento_experto: "corporativo" }), u(2, { segmento_experto: "corporativo" }), u(3, { segmento_experto: "corporativo" })];
  const regs = Array.from({ length: 6 }, (_, i) => r(i + 1, { empleados: 900 }));
  const res = proponer("reglas", datos(usuarios, regs), parametros(HOY));
  const cuenta = [1, 2, 3].map((id) => res.propuestas.filter((p) => p.usuario_id === id).length);
  assert.deepEqual(cuenta, [2, 2, 2]);
  const p = res.propuestas[2].candidatos[0].desglose!;
  assert.ok("balance_grandes" in p);
});
test("reglas: un experto corporativo con muchas cuentas grandes cede ante otro que tiene pocas", () => {
  const perfiles = calcularPerfiles([{ id: 1, fecha_ingreso: "2020-01-01" }, { id: 2, fecha_ingreso: "2020-01-01" }], [], [], new Map(), [], HOY);
  perfiles[1].corporativo = 8; perfiles[1].cuentas = 8;
  const usuarios = [u(1, { segmento_experto: "corporativo" }), u(2, { segmento_experto: "corporativo" })];
  const res = proponer("reglas", datos(usuarios, [r(1, { empleados: 900 })], { perfiles }), parametros(HOY));
  assert.equal(res.propuestas[0].usuario_id, 2);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { medirResultado } from "../src/lib/engine/metricas";
import { parametros, proponer } from "../src/lib/engine/motor";
import type { Ausencia, Registro, ResultadoMotor, Usuario } from "../src/lib/engine/tipos";

const FECHA = "2026-09-27";
const u = (id: number, p: Partial<Usuario> = {}): Usuario => ({
  id, nombre: `V${id}`, rol: "vendedor", equipo_id: 1, zona: "Centro", segmento_experto: "pyme",
  capacidad_maxima: 10, fecha_ingreso: "2020-01-01", activo: true, banderas: [], ...p,
});
const r = (id: number, p: Partial<Registro> = {}): Registro => ({
  id, razon_social: `Empresa ${id}`, nit: `${id}`, sector: "Retail", empleados: 20, ingresos_estimados: 1_000_000_000,
  ciudad: "Bogotá", zona: "Centro", fuente: "web", notas: null, estado: "nuevo", fecha_creacion: "2026-09-01",
  duplicado_de: null, banderas: [], ...p,
});

test("medirResultado: cuenta segmento, zona y balance de un reparto del motor sin romper reglas", () => {
  const usuarios = [u(1), u(2, { zona: "Norte", segmento_experto: "industrial" })];
  const registros = [r(1), r(2), r(3, { zona: "Norte" })];
  const res = proponer("balanceo_carga", { usuarios, registros, ausencias: [], cargaInicial: {} }, parametros(FECHA));
  const m = medirResultado(res, { usuarios, registros, ausencias: [], fecha: FECHA });
  assert.equal(m.asignados, 3);
  assert.equal(m.reglas_rotas, 0);
  assert.ok(m.pct_zona !== null && m.pct_zona >= 0 && m.pct_zona <= 100);
});

test("medirResultado: detecta reglas duras rotas aunque el motor no las produzca", () => {
  const usuarios = [u(1, { fecha_ingreso: "2026-06-01" }), u(2)];   // el 1 está en rampa
  const registros = [r(1, { empleados: 500, ingresos_estimados: 50_000_000_000 }), r(2)];
  const ausencias: Ausencia[] = [{ id: 1, usuario_id: 2, desde: "2026-09-20", hasta: "2026-10-30", motivo: "vacaciones" }];
  const falso: ResultadoMotor = {
    metodo: "reglas", parametros: parametros(FECHA), retenidos: [], cargaFinal: { 1: 1, 2: 1 },
    propuestas: [
      { registro_id: 1, usuario_id: 1, motivo: "", candidatos: [], segmento: "corporativo", banderas_decision: [] }, // rampa + corporativa + menos de 2 años
      { registro_id: 2, usuario_id: 2, motivo: "", candidatos: [], segmento: "pyme", banderas_decision: [] },        // ausente
    ],
  };
  const m = medirResultado(falso, { usuarios, registros, ausencias, fecha: FECHA });
  assert.equal(m.reglas_rotas, 3);
});

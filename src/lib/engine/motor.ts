import { evaluarCandidato, type ContextoFiltros } from "./filtros";
import { balanceoCarga, reglas, roundRobin, type EstadoLote, type Seleccion } from "./metodos";
import { segmentoDe, tamano } from "./segmento";
import {
  PARAMETROS_DEFECTO, type Ausencia, type EvaluacionCandidato, type Metodo, type ParametrosMotor,
  type Propuesta, type Registro, type ResultadoMotor, type Retenido, type Usuario,
} from "./tipos";

export interface DatosMotor {
  registros: Registro[];           // los candidatos a repartir (normalmente estado = nuevo)
  usuarios: Usuario[];
  ausencias: Ausencia[];
  /** Carga actual por usuario (ver calcularCarga). */
  cargaInicial: Record<number, number>;
}

export function parametros(fechaReferencia: string, parcial: Partial<ParametrosMotor> = {}): ParametrosMotor {
  return { ...PARAMETROS_DEFECTO, ...parcial, pesos: { ...PARAMETROS_DEFECTO.pesos, ...parcial.pesos }, fechaReferencia };
}

/** Razones por las que un registro NO se asigna sino que se retiene para revisión humana. */
export function razonesRetencion(r: Registro, params: ParametrosMotor): string[] {
  const out: string[] = [];
  if (r.estado !== "nuevo") out.push(`estado_${r.estado}`);
  if (r.duplicado_de !== null && params.retener.includes("duplicado")) out.push(`duplicado_de_${r.duplicado_de}`);
  for (const b of r.banderas) if (b !== "posible_duplicado" && params.retener.includes(b)) out.push(b);
  return out;
}

/** Evalúa a todos los usuarios para un registro y aplica el desborde de zona si hace falta. */
export function evaluarRegistro(r: Registro, d: DatosMotor, ctx: ContextoFiltros) {
  let evals = d.usuarios.map((u) => evaluarCandidato(u, r, ctx));
  let desborde = false;
  if (!evals.some((e) => e.elegible) && ctx.params.zona === "estricta" && ctx.params.desbordarSiNoHay) {
    const alt = d.usuarios.map((u) => evaluarCandidato(u, r, ctx, true));
    if (alt.some((e) => e.elegible)) { evals = alt; desborde = true; }
  }
  return { evals, desborde };
}

const SELECTORES = { round_robin: roundRobin, balanceo_carga: balanceoCarga, reglas } as const;

/** Reparte un lote con un método determinista. Puro: no escribe en ninguna parte. */
export function proponer(metodo: Exclude<Metodo, "ia">, d: DatosMotor, params: ParametrosMotor): ResultadoMotor {
  const carga: Record<number, number> = { ...d.cargaInicial };
  const usuarios = new Map(d.usuarios.map((u) => [u.id, u]));
  const estado: EstadoLote = { pesosRR: {} };
  const ctx: ContextoFiltros = { ausencias: d.ausencias, carga, params };

  const retenidos: Retenido[] = [];
  const porAsignar: Registro[] = [];
  for (const r of d.registros) {
    const razones = razonesRetencion(r, params);
    if (razones.length) retenidos.push({ registro_id: r.id, razones });
    else porAsignar.push(r);
  }
  // FIFO (el que más lleva esperando primero); en reglas las cuentas grandes van antes.
  porAsignar.sort((a, b) =>
    (metodo === "reglas" ? tamano(b) - tamano(a) : 0) || a.fecha_creacion.localeCompare(b.fecha_creacion) || a.id - b.id);

  const propuestas: Propuesta[] = [];
  for (const r of porAsignar) {
    const { evals, desborde } = evaluarRegistro(r, d, ctx);
    const elegibles = evals.filter((e) => e.elegible);
    const base = { registro_id: r.id, segmento: segmentoDe(r), banderas_decision: desborde ? ["desborde_zona"] : [] };
    if (!elegibles.length) {
      propuestas.push({ ...base, usuario_id: null, candidatos: evals, motivo: "Sin candidato elegible: todos descartados por los filtros duros." });
      continue;
    }
    const sel: Seleccion = SELECTORES[metodo]({ registro: r, elegibles, usuarios, params, estado });
    const candidatos: EvaluacionCandidato[] = evals.map((e) => ({ ...e, ...sel.anotar?.[e.usuario_id] }));
    carga[sel.usuario_id] = (carga[sel.usuario_id] ?? 0) + 1;
    propuestas.push({
      ...base, usuario_id: sel.usuario_id, candidatos,
      motivo: sel.motivo + (desborde ? ` Sin candidatos en la zona ${r.zona}: se desbordó a otras zonas.` : ""),
    });
  }
  return { metodo, parametros: params, propuestas, retenidos, cargaFinal: carga };
}

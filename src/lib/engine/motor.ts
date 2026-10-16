import { clonarPerfiles, perfilVacio, type PerfilVendedor } from "./cartera";
import { contextoRegistro, evaluarCandidato, type ContextoFiltros } from "./filtros";
import { balanceoCarga, reglas, roundRobin, type EstadoLote, type Seleccion } from "./metodos";
import { compararPrioridad } from "./prioridad";
import { segmentoDe } from "./segmento";
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
  /** Cartera actual de cada vendedor (ver calcularPerfiles). Si falta, se parte de cartera vacía. */
  perfiles?: Record<number, PerfilVendedor>;
}

export function parametros(fechaReferencia: string, parcial: Partial<ParametrosMotor> = {}): ParametrosMotor {
  return { ...PARAMETROS_DEFECTO, ...parcial, pesos: { ...PARAMETROS_DEFECTO.pesos, ...parcial.pesos }, fechaReferencia };
}

/** Razones por las que un registro NO se asigna sino que se retiene para revisión humana. */
export function razonesRetencion(r: Registro, params: ParametrosMotor): string[] {
  const out: string[] = [];
  if (!params.estados.includes(r.estado)) out.push(`estado_${r.estado}`);
  if (r.duplicado_de !== null && params.retener.includes("duplicado")) out.push(`duplicado_de_${r.duplicado_de}`);
  if (params.usarNotasIA && r.senales?.no_contactar && params.retener.includes("pidio_no_insistir") && !r.banderas.includes("pidio_no_insistir")) out.push("nota_no_contactar");
  for (const b of r.banderas) {
    if (b.startsWith("duplicado_en_")) { if (params.retener.includes("duplicado")) out.push(b); }
    else if (b !== "posible_duplicado" && params.retener.includes(b)) out.push(b);
  }
  return out;
}

/** Evalúa a todos los usuarios para un registro y aplica el desborde de zona si hace falta. */
export function evaluarRegistro(r: Registro, d: DatosMotor, ctx: ContextoFiltros) {
  const reg = contextoRegistro(r);
  let evals = d.usuarios.map((u) => evaluarCandidato(u, reg, ctx));
  let desborde = false;
  if (!evals.some((e) => e.elegible) && ctx.params.zona === "estricta" && ctx.params.desbordarSiNoHay) {
    const alt = d.usuarios.map((u) => evaluarCandidato(u, reg, ctx, true));
    if (alt.some((e) => e.elegible)) { evals = alt; desborde = true; }
  }
  return { evals, desborde };
}

const SELECTORES = { round_robin: roundRobin, balanceo_carga: balanceoCarga, reglas } as const;

/** Separa retenidos de asignables y ordena el lote. Común a los métodos deterministas y al de IA. */
export function prepararLote(metodo: Metodo, d: DatosMotor, params: ParametrosMotor) {
  void metodo;
  const carga: Record<number, number> = { ...d.cargaInicial };
  const usuarios = new Map(d.usuarios.map((u) => [u.id, u]));
  // Cartera de cada vendedor: la actual, que el motor va actualizando a medida que reparte (copia propia).
  const perfiles = clonarPerfiles(d.perfiles ?? {});
  for (const u of d.usuarios) perfiles[u.id] ??= perfilVacio(u, params.fechaReferencia);
  const ctx: ContextoFiltros = { ausencias: d.ausencias, carga, params, perfiles };
  const retenidos: Retenido[] = [];
  const porAsignar: Registro[] = [];
  for (const r of d.registros) {
    const razones = razonesRetencion(r, params);
    if (razones.length) retenidos.push({ registro_id: r.id, razones });
    else porAsignar.push(r);
  }
  // Orden de reparto: quien va primero elige primero (ver prioridad.ts, la única definición del orden).
  porAsignar.sort(compararPrioridad(params));
  return { carga, usuarios, ctx, perfiles, retenidos, porAsignar };
}

/** Arma la propuesta de un registro y actualiza la carga y la cartera del lote si hubo elegido. */
export function cerrarPropuesta(
  r: Registro, evals: EvaluacionCandidato[], desborde: boolean, sel: Seleccion | null, carga: Record<number, number>,
  extra: Partial<Propuesta> = {}, perfiles?: Record<number, PerfilVendedor>,
): Propuesta {
  const segmento = segmentoDe(r);
  const base = { registro_id: r.id, segmento, banderas_decision: desborde ? ["desborde_zona"] : [], senales: r.senales };
  if (!sel) {
    return { ...base, usuario_id: null, candidatos: evals, motivo: "Sin candidato elegible: todos descartados por los filtros duros.", ...extra };
  }
  carga[sel.usuario_id] = (carga[sel.usuario_id] ?? 0) + 1;
  const p = perfiles?.[sel.usuario_id];
  if (p) { p.cuentas++; p[segmento]++; p.ingresos += r.ingresos_estimados ?? 0; }
  return {
    ...base, usuario_id: sel.usuario_id, candidatos: evals.map((e) => ({ ...e, ...sel.anotar?.[e.usuario_id] })),
    motivo: sel.motivo + (desborde ? ` Sin candidatos en la zona ${r.zona}: se desbordó a otras zonas.` : ""), ...extra,
  };
}

/** Reparte un lote con un método determinista. Puro: no escribe en ninguna parte. */
export function proponer(metodo: Exclude<Metodo, "ia">, d: DatosMotor, params: ParametrosMotor): ResultadoMotor {
  const { carga, usuarios, ctx, perfiles, retenidos, porAsignar } = prepararLote(metodo, d, params);
  const estado: EstadoLote = { pesosRR: {} };
  const propuestas: Propuesta[] = [];
  for (const r of porAsignar) {
    const { evals, desborde } = evaluarRegistro(r, d, ctx);
    const elegibles = evals.filter((e) => e.elegible);
    const sel = elegibles.length ? SELECTORES[metodo]({ registro: r, elegibles, usuarios, params, estado }) : null;
    propuestas.push(cerrarPropuesta(r, evals, desborde, sel, carga, {}, perfiles));
  }
  return { metodo, parametros: params, propuestas, retenidos, cargaFinal: carga };
}

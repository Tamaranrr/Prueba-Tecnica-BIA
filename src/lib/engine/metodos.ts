import { diasEntre } from "./filtros";
import { segmentoDe, senalesNota } from "./segmento";
import type { EvaluacionCandidato, ParametrosMotor, Registro, Usuario } from "./tipos";

/** Estado mutable que un método puede necesitar durante un lote. */
export interface EstadoLote { pesosRR: Record<number, number> }

export interface Seleccion {
  usuario_id: number; motivo: string;
  /** Puntajes/desglose por candidato para guardar en la traza. */
  anotar?: Record<number, { puntaje?: number; desglose?: Record<string, number> }>;
}
export interface EntradaMetodo {
  registro: Registro; elegibles: EvaluacionCandidato[]; usuarios: Map<number, Usuario>;
  params: ParametrosMotor; estado: EstadoLote;
}

const ratio = (c: EvaluacionCandidato) => c.carga / (c.capacidad as number);
const libre = (c: EvaluacionCandidato) => (c.capacidad as number) - c.carga;

/** 1. Round-robin ponderado (smooth weighted RR): rota, pero da más turnos a quien tiene más cupo libre. */
export function roundRobin({ elegibles, estado }: EntradaMetodo): Seleccion {
  let total = 0;
  for (const c of elegibles) {
    const w = libre(c);
    estado.pesosRR[c.usuario_id] = (estado.pesosRR[c.usuario_id] ?? 0) + w;
    total += w;
  }
  const orden = [...elegibles].sort((a, b) => estado.pesosRR[b.usuario_id] - estado.pesosRR[a.usuario_id] || a.usuario_id - b.usuario_id);
  const g = orden[0];
  estado.pesosRR[g.usuario_id] -= total;
  return {
    usuario_id: g.usuario_id,
    motivo: `Round-robin ponderado por cupo libre: le tocaba el turno (cupo libre ${libre(g)}, ${elegibles.length} candidatos elegibles).`,
  };
}

/** 2. Balanceo de carga: el de menor ocupación relativa (carga/capacidad). */
export function balanceoCarga({ elegibles }: EntradaMetodo): Seleccion {
  const orden = [...elegibles].sort((a, b) => ratio(a) - ratio(b) || libre(b) - libre(a) || a.usuario_id - b.usuario_id);
  const g = orden[0];
  const anotar = Object.fromEntries(elegibles.map((c) => [c.usuario_id, { puntaje: Math.round((1 - ratio(c)) * 100) }]));
  return {
    usuario_id: g.usuario_id, anotar,
    motivo: `Menor ocupación relativa: ${g.carga}/${g.capacidad} (${Math.round(ratio(g) * 100)}%) entre ${elegibles.length} candidatos.`,
  };
}

/**
 * Regla explícita (no un peso): las cuentas grandes son la causa de las peleas, así que solo compiten los
 * expertos corporativos elegibles y con la antigüedad mínima. Si no queda ninguno, compite cualquiera y se dice.
 * La usan el método de reglas y el de IA (el modelo solo ve este grupo).
 */
export function grupoParaCuenta(seg: string, elegibles: EvaluacionCandidato[], usuarios: Map<number, Usuario>, params: ParametrosMotor) {
  if (seg !== "corporativo" || !params.grandesSoloExpertos) return { pool: elegibles, nota: "" };
  const expertos = elegibles.filter((c) => {
    const u = usuarios.get(c.usuario_id)!;
    return u.segmento_experto === "corporativo" && (!u.fecha_ingreso || diasEntre(u.fecha_ingreso, params.fechaReferencia) >= params.pesos.diasMinCorporativo);
  });
  return expertos.length
    ? { pool: expertos, nota: "; cuenta corporativa: solo compiten expertos corporativos" }
    : { pool: elegibles, nota: "; cuenta corporativa sin expertos corporativos disponibles: compite cualquiera" };
}

/** 3. Reglas de negocio ponderadas: segmento, zona, carga y antigüedad, más restricciones por tamaño/notas. */
export function reglas({ registro, elegibles, usuarios, params }: EntradaMetodo): Seleccion {
  const p = params.pesos;
  const seg = segmentoDe(registro);
  const nota = senalesNota(registro.notas);
  // Lectura de la nota por IA (si se pidió y hay). Suma a lo que ya detecta el texto exacto, no lo reemplaza.
  const sen = params.usarNotasIA ? registro.senales : undefined;
  const pideSenior = nota.pideSenior || !!sen?.perfil_senior;
  const pideSector = nota.pideConocerSector || !!sen?.experto_sector;
  const industrial = !!sen?.necesidad_industrial && seg !== "corporativo";
  const poco = sen?.urgencia === "baja";
  const anotar: NonNullable<Seleccion["anotar"]> = {};
  const { pool, nota: nota_pool } = grupoParaCuenta(seg, elegibles, usuarios, params);
  for (const c of elegibles) if (!pool.includes(c)) anotar[c.usuario_id] = { puntaje: undefined, desglose: { fuera_del_grupo_de_expertos_corporativos: 0 } };
  const puntuados = pool.map((c) => {
    const u = usuarios.get(c.usuario_id)!;
    const dias = u.fecha_ingreso ? diasEntre(u.fecha_ingreso, params.fechaReferencia) : 365 * 5; // sin fecha: se asume antiguo
    const anios = dias / 365;
    const des: Record<string, number> = {};
    des.segmento = u.segmento_experto === seg ? p.segmento : 0;
    des.zona = registro.zona && u.zona === registro.zona ? p.zona : 0;
    des.carga = Math.round(p.carga * (1 - ratio(c)));
    // Antigüedad: desempata a favor de la experiencia, salvo en cuentas de poca prioridad, donde los nuevos ganan ritmo.
    des.antiguedad = Math.round(p.antiguedad * (poco ? 1 - Math.min(anios, 5) / 5 : Math.min(anios, 5) / 5));
    if (industrial && u.segmento_experto === "industrial") des.necesidad_industrial = p.segmento;
    // Restricciones fuertes: las cuentas grandes no van a vendedores nuevos; las notas pesan.
    if (seg === "corporativo" && dias < p.diasMinCorporativo) des.cuenta_grande_vendedor_nuevo = -1000;
    if (pideSenior && anios < p.aniosSenior) des.nota_pide_senior = -500;
    if (pideSector && u.segmento_experto !== seg) des.nota_pide_conocer_sector = -300;
    const puntaje = Object.values(des).reduce((a, b) => a + b, 0);
    anotar[c.usuario_id] = { puntaje, desglose: des };
    return { c, puntaje };
  });
  puntuados.sort((a, b) => b.puntaje - a.puntaje || ratio(a.c) - ratio(b.c) || a.c.usuario_id - b.c.usuario_id);
  const g = puntuados[0];
  const d = anotar[g.c.usuario_id].desglose!;
  const notas = [pideSenior && "pide senior", pideSector && "pide conocer el sector", industrial && "necesidad industrial", poco && "poco prioritaria: favorece a vendedores nuevos"].filter(Boolean);
  const motivo =
    `Reglas: cuenta ${seg}; ${g.puntaje} pts (segmento ${d.segmento}, zona ${d.zona}, carga ${d.carga}, antigüedad ${d.antiguedad})` +
    (notas.length ? `; lo que dice la nota (${notas.join(", ")}) se aplicó` : "") + nota_pool + ".";
  return { usuario_id: g.c.usuario_id, motivo, anotar };
}

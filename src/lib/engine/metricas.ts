import { antiguedadDe } from "./antiguedad";
import { ausenciaProxima, ausenciaVigente } from "./filtros";
import { segmentoDe } from "./segmento";
import { PARAMETROS_DEFECTO, type Ausencia, type Registro, type ResultadoMotor, type Usuario } from "./tipos";

/** Cómo quedó un reparto, medido con un cálculo independiente del motor (las reglas duras se vuelven a comprobar aparte). */
export interface Medicion {
  asignados: number; sin_candidato: number; retenidos: number;
  /** % de lo asignado que fue a un experto de su segmento y a un vendedor de su zona. */
  pct_segmento: number | null; pct_zona: number | null;
  grandes: number; grandes_con_experto: number; personas_con_grandes: number;
  /** Ocupación (carga ÷ capacidad) del vendedor más lleno tras el reparto y desviación entre vendedores, en puntos. */
  ocupacion_maxima: number; desbalance: number;
  /** Reglas duras rotas: debe ser 0 con cualquier método. */
  reglas_rotas: number; respaldos_ia: number;
}

export interface ContextoMedicion {
  usuarios: Usuario[]; registros: Registro[]; ausencias: Ausencia[]; fecha: string;
}

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : null);

export function medirResultado(res: ResultadoMotor, c: ContextoMedicion): Medicion {
  const usuarios = new Map(c.usuarios.map((u) => [u.id, u]));
  const regs = new Map(c.registros.map((r) => [r.id, r]));
  const asig = res.propuestas.filter((p) => p.usuario_id !== null);
  let seg = 0, zona = 0, grandes = 0, grandesExp = 0, rotas = 0;
  const conGrandes = new Set<number>();
  for (const p of asig) {
    const r = regs.get(p.registro_id), u = usuarios.get(p.usuario_id!);
    if (!r || !u) continue;
    const { nivel, dias } = antiguedadDe(u.fecha_ingreso, c.fecha);
    if (u.segmento_experto === p.segmento) seg++;
    if (u.zona === r.zona) zona++;
    if (p.segmento === "corporativo") {
      grandes++; conGrandes.add(u.id);
      if (u.segmento_experto === "corporativo") grandesExp++;
      if (dias !== null && dias < PARAMETROS_DEFECTO.pesos.diasMinCorporativo) rotas++;
    }
    if (ausenciaVigente(c.ausencias, u.id, c.fecha)) rotas++;
    if (ausenciaProxima(c.ausencias, u.id, c.fecha, PARAMETROS_DEFECTO.ventanaAusenciaDias)) rotas++;
    if (!u.activo || u.capacidad_maxima === null) rotas++;
    if (nivel === "rampa" && segmentoDe(r) !== "pyme") rotas++;
  }
  const ocup = c.usuarios
    .filter((u) => u.rol === "vendedor" && u.activo && u.capacidad_maxima !== null && res.cargaFinal[u.id] !== undefined)
    .map((u) => (res.cargaFinal[u.id] ?? 0) / (u.capacidad_maxima === 0 ? PARAMETROS_DEFECTO.capacidadRampa : (u.capacidad_maxima as number)));
  const media = ocup.length ? ocup.reduce((a, b) => a + b, 0) / ocup.length : 0;
  const desv = ocup.length ? Math.sqrt(ocup.reduce((a, b) => a + (b - media) ** 2, 0) / ocup.length) * 100 : 0;
  return {
    asignados: asig.length, sin_candidato: res.propuestas.length - asig.length, retenidos: res.retenidos.length,
    pct_segmento: pct(seg, asig.length), pct_zona: pct(zona, asig.length),
    grandes, grandes_con_experto: grandesExp, personas_con_grandes: conGrandes.size,
    ocupacion_maxima: ocup.length ? Math.round(Math.max(...ocup) * 100) : 0, desbalance: Math.round(desv * 10) / 10,
    reglas_rotas: rotas, respaldos_ia: res.propuestas.filter((p) => p.banderas_decision.includes("ia_respaldo")).length,
  };
}

import { antiguedadDe } from "./antiguedad";
import { diasEntre, sumaDias } from "./fechas";
import type { PerfilVendedor } from "./cartera";
import { resumenDe } from "./cartera";
import { segmentoDe } from "./segmento";
import type { Ausencia, EvaluacionCandidato, ParametrosMotor, Registro, Segmento, Usuario } from "./tipos";

export { diasEntre } from "./fechas";

/** Ausencia vigente en la fecha (hasta null = abierta, sin fecha de fin). */
export function ausenciaVigente(ausencias: Ausencia[], usuarioId: number, fecha: string): Ausencia | undefined {
  return ausencias.find((a) => a.usuario_id === usuarioId && a.desde <= fecha && (a.hasta === null || a.hasta >= fecha));
}

/** Ausencia que empieza después de la fecha pero dentro de la ventana de días: quien sale pronto no debería recibir cuentas nuevas. */
export function ausenciaProxima(ausencias: Ausencia[], usuarioId: number, fecha: string, dias: number): Ausencia | undefined {
  if (dias <= 0) return undefined;
  const limite = sumaDias(fecha, dias);
  return ausencias.find((a) => a.usuario_id === usuarioId && a.desde > fecha && a.desde <= limite);
}

/**
 * Capacidad con la que se evalúa a un vendedor. Un recién entrado (rampa) con capacidad 0 recibe una capacidad
 * provisional, para que pueda nivelarse; con capacidad vacía (sin dato) o ya fuera de rampa no se toca.
 */
export function capacidadEfectiva(
  u: Pick<Usuario, "capacidad_maxima" | "fecha_ingreso">, fecha: string, capacidadRampa: number,
): { capacidad: number | null; provisional: boolean } {
  if (u.capacidad_maxima === 0 && capacidadRampa > 0 && antiguedadDe(u.fecha_ingreso, fecha).nivel === "rampa") {
    return { capacidad: capacidadRampa, provisional: true };
  }
  return { capacidad: u.capacidad_maxima, provisional: false };
}

export interface ContextoFiltros {
  ausencias: Ausencia[];
  carga: Record<number, number>;
  params: ParametrosMotor;
  /** Cartera de cada vendedor (se actualiza durante el lote). Si falta, solo se omite la foto de cartera en la traza. */
  perfiles?: Record<number, PerfilVendedor>;
}

/** Lo que los filtros necesitan saber de un registro. */
export interface ContextoRegistro { zona: string | null; segmento?: Segmento; dueno_actual?: number | null }
export const contextoRegistro = (r: Registro): ContextoRegistro => ({ zona: r.zona, segmento: segmentoDe(r), dueno_actual: r.dueno_actual });

/**
 * Filtros DUROS: lo que ningún método puede saltarse. Un usuario que no los cumple nunca
 * llega a un método ni al modelo de IA. `ignorarZona` se usa solo para el desborde.
 */
export function evaluarCandidato(
  u: Usuario, reg: ContextoRegistro, ctx: ContextoFiltros, ignorarZona = false,
): EvaluacionCandidato {
  const { params, ausencias, carga } = ctx;
  const fecha = params.fechaReferencia;
  const d: string[] = [];
  const { nivel } = antiguedadDe(u.fecha_ingreso, fecha);

  if (u.rol === "admin" || (u.rol === "lider" && !params.incluirLideres)) d.push(`rol_${u.rol}_no_asignable`);
  if (params.excluirUsuarios.includes(u.id)) d.push("excluido_del_lote");
  if (reg.dueno_actual === u.id) d.push("es_el_dueno_actual");
  if (!u.activo) d.push("inactivo");
  if (u.fecha_ingreso && u.fecha_ingreso > fecha) d.push(`aun_no_ingresa(${u.fecha_ingreso})`);
  const aus = ausenciaVigente(ausencias, u.id, fecha);
  if (aus) d.push(`ausente(${aus.motivo})`);
  else {
    const prox = ausenciaProxima(ausencias, u.id, fecha, params.ventanaAusenciaDias);
    if (prox) d.push(`se_ausenta_el_${prox.desde}(${prox.motivo})`);
  }

  const { capacidad: cap, provisional } = capacidadEfectiva(u, fecha, params.capacidadRampa);
  const usado = carga[u.id] ?? 0;
  if (cap === null) d.push("sin_capacidad_definida");
  else if (cap <= 0) d.push("capacidad_cero");
  else if (usado >= cap) d.push(`sin_cupo(${usado}/${cap})`);

  // Una cuenta corporativa pide experiencia: se exige a todos los métodos, no solo a las reglas.
  if (params.soloPlenoParaGrandes && reg.segmento === "corporativo" && u.fecha_ingreso && diasEntre(u.fecha_ingreso, fecha) < params.pesos.diasMinCorporativo) {
    d.push(`cuenta_corporativa_pide_${Math.round(params.pesos.diasMinCorporativo / 365)}_anos_de_antiguedad`);
  }
  if (params.rampaSoloPyme && nivel === "rampa" && reg.segmento && reg.segmento !== "pyme") d.push(`en_rampa_solo_cuentas_pyme(cuenta ${reg.segmento})`);
  if (!ignorarZona && params.zona === "estricta" && reg.zona && u.zona !== reg.zona) d.push(`otra_zona(${u.zona ?? "sin zona"})`);

  const perfil = ctx.perfiles?.[u.id];
  return {
    usuario_id: u.id, nombre: u.nombre, elegible: d.length === 0, descartes: d, carga: usado, capacidad: cap,
    ...(provisional ? { capacidad_provisional: true } : {}), ...(perfil ? { cartera: resumenDe(perfil) } : {}),
  };
}

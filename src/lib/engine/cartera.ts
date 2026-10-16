import { antiguedadDe } from "./antiguedad";
import { diasEntre } from "./fechas";
import { segmentoDe } from "./segmento";
import { esVivo, type Actividad, type Registro, type ResumenCartera, type Usuario } from "./tipos";

/**
 * Perfil de un vendedor: lo que ya tiene encima y cómo se ha movido. Sale de los registros vivos cuyo dueño es el
 * vendedor y de la actividad. El motor lo va actualizando a medida que reparte un lote, para que cada decisión vea
 * lo que ya se asignó en esa misma corrida.
 */
export type PerfilVendedor = ResumenCartera & { usuario_id: number };

/** Una cuenta viva sin movimiento en tantos días se considera "fría". */
export const DIAS_FRIA = 30;

const dia = (iso: string) => iso.slice(0, 10);
type Vigente = { registro_id: number; creada_en: string };

/** Último movimiento de cada registro: la última actividad o su asignación vigente, lo más reciente; si no hay, su creación. */
export function ultimosMovimientos(
  registros: Pick<Registro, "id" | "fecha_creacion">[], actividad: Actividad[], vigentes: Vigente[] = [],
): Map<number, string> {
  const ult = new Map<number, string>(registros.map((r) => [r.id, r.fecha_creacion]));
  const sube = (id: number, f: string) => { const a = ult.get(id); if (a !== undefined && f > a) ult.set(id, f); };
  for (const a of actividad) sube(a.registro_id, a.fecha);
  for (const v of vigentes) sube(v.registro_id, dia(v.creada_en));
  return ult;
}

/** Registros vivos sin movimiento en `dias` días o más a la fecha dada. */
export function cuentasFrias(registros: Registro[], actividad: Actividad[], vigentes: Vigente[], fecha: string, dias = DIAS_FRIA): Set<number> {
  const vivos = registros.filter((r) => esVivo(r.estado));
  const ult = ultimosMovimientos(vivos, actividad, vigentes);
  return new Set(vivos.filter((r) => diasEntre(ult.get(r.id) as string, fecha) >= dias).map((r) => r.id));
}

export function perfilVacio(u: Pick<Usuario, "id" | "fecha_ingreso">, fecha: string): PerfilVendedor {
  const a = antiguedadDe(u.fecha_ingreso, fecha);
  return {
    usuario_id: u.id, nivel: a.nivel, antiguedadDias: a.dias, antiguedadEstimada: a.estimada,
    cuentas: 0, corporativo: 0, industrial: 0, pyme: 0, ingresos: 0, acciones14d: 0, diasDesdeUltima: null, frias: 0,
  };
}

/**
 * `registros` debe traer solo lo que cuenta como cartera (el servicio excluye lo que se está moviendo en el lote).
 * `actividad` es toda: la intensidad y la recencia de un vendedor no dependen del lote.
 */
export function calcularPerfiles(
  usuarios: Pick<Usuario, "id" | "fecha_ingreso">[], registros: Registro[], actividad: Actividad[],
  duenos: Map<number, number>, vigentes: Vigente[], fecha: string,
): Record<number, PerfilVendedor> {
  const perfiles: Record<number, PerfilVendedor> = {};
  for (const u of usuarios) perfiles[u.id] = perfilVacio(u, fecha);

  const frias = cuentasFrias(registros, actividad, vigentes, fecha);
  for (const r of registros) {
    if (!esVivo(r.estado)) continue;
    const p = perfiles[duenos.get(r.id) ?? -1];
    if (!p) continue;
    p.cuentas++;
    p[segmentoDe(r)]++;
    p.ingresos += r.ingresos_estimados ?? 0;
    if (frias.has(r.id)) p.frias++;
  }
  for (const a of actividad) {
    const p = perfiles[a.usuario_id];
    if (!p || a.fecha > fecha) continue;
    const d = diasEntre(a.fecha, fecha);
    if (d < 14) p.acciones14d++;
    if (p.diasDesdeUltima === null || d < p.diasDesdeUltima) p.diasDesdeUltima = d;
  }
  return perfiles;
}

/** Copia independiente: el motor muta su copia durante un lote sin tocar la original. */
export const clonarPerfiles = (p: Record<number, PerfilVendedor>): Record<number, PerfilVendedor> =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v }]));

/** Foto de la cartera para la traza (sin el id). */
export const resumenDe = (p: PerfilVendedor): ResumenCartera => {
  const { usuario_id: _id, ...resto } = p;
  void _id;
  return { ...resto };
};

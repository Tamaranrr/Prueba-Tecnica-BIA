import { db, ErrorNegocio, ok } from "./db";
import { calcularCarga, duenosActuales } from "./engine/carga";
import { evaluarCandidato } from "./engine/filtros";
import { marcarDuplicadosEnTrabajo } from "./engine/duplicados";
import { parametros, proponer, razonesRetencion, type DatosMotor } from "./engine/motor";
import { leerSenales } from "./notasServicio";
import type { SenalesNota } from "./notas";
import { LIMITE_IA_DEFECTO, LIMITE_IA_MAXIMO, MODELO_IA, PROMPT_VERSION, proponerIA } from "./ia";
import type {
  Actividad, Ausencia, EvaluacionCandidato, Metodo, ParametrosMotor, Registro, ResultadoMotor, Usuario,
} from "./engine/tipos";

export type MetodoDeterminista = Exclude<Metodo, "ia">;
export type Alcance =
  | { tipo: "pendientes" }
  | { tipo: "usuario"; usuario_id: number }     // reasignar todo lo vivo de un vendedor
  | { tipo: "registros"; ids: number[] };       // reasignar registros concretos

export interface Solicitud {
  metodo: Metodo;
  /** Solo método IA: máximo de registros que se consultan al modelo en esta corrida. */
  ia?: { limite?: number };
  alcance: Alcance;
  parametros?: Partial<ParametrosMotor>;
  fechaReferencia?: string;
}

export const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

interface FilaAsignacion {
  id: string; registro_id: number; usuario_id: number; vigente: boolean; ejecucion_id: string;
  metodo: string; motivo: string | null; creada_en: string;
}

export async function leerTodo() {
  const c = db();
  const [usuarios, registros, ausencias, actividad, vigentes] = await Promise.all([
    c.from("usuarios").select("*").order("id"),
    c.from("registros").select("*").order("id"),
    c.from("ausencias").select("*"),
    c.from("actividad").select("*"),
    c.from("asignaciones").select("id,registro_id,usuario_id,vigente,ejecucion_id,metodo,motivo,creada_en").eq("vigente", true),
  ]);
  return {
    usuarios: ok(usuarios, "usuarios") as unknown as Usuario[],
    registros: ok(registros, "registros") as unknown as Registro[],
    ausencias: ok(ausencias, "ausencias") as unknown as Ausencia[],
    actividad: ok(actividad, "actividad") as unknown as Actividad[],
    vigentes: ok(vigentes, "asignaciones") as unknown as FilaAsignacion[],
  };
}
type Base = Awaited<ReturnType<typeof leerTodo>>;

/** Arma el lote, la carga y los parámetros efectivos. No corre ningún método ni escribe nada. */
export function armarLote(base: Base, sol: Solicitud, senales?: Map<string, SenalesNota>) {
  const fecha = sol.fechaReferencia ?? hoy();
  const duenos = duenosActuales(base.actividad, base.vigentes);
  let lote: Registro[];
  // La zona estricta tiene sentido para balancear; en reglas e IA (que pesan el encaje de segmento) la zona es una preferencia.
  let extra: Partial<ParametrosMotor> = { zona: sol.metodo === "reglas" || sol.metodo === "ia" ? "preferente" : "estricta", ...sol.parametros };

  if (sol.alcance.tipo === "pendientes") {
    lote = base.registros.filter((r) => r.estado === "nuevo");
  } else if (sol.alcance.tipo === "usuario") {
    const uid = sol.alcance.usuario_id;
    lote = base.registros.filter((r) => ["asignado", "en_gestion"].includes(r.estado) && duenos.get(r.id) === uid);
    extra = { ...extra, estados: ["asignado", "en_gestion"], excluirUsuarios: [...(extra.excluirUsuarios ?? []), uid] };
  } else {
    const ids = new Set(sol.alcance.ids);
    lote = base.registros.filter((r) => ids.has(r.id));
    if (lote.length !== ids.size) throw new ErrorNegocio("Hay registros que no existen en la selección.");
    extra = { ...extra, estados: ["nuevo", "asignado", "en_gestion"] };
    for (const r of lote) {
      const d = duenos.get(r.id);
      if (d !== undefined && r.estado !== "nuevo") extra.excluirUsuarios = [...new Set([...(extra.excluirUsuarios ?? []), d])];
    }
  }

  lote = marcarDuplicadosEnTrabajo(lote, base.registros);
  // Lectura de las notas hecha por IA (si se pidió): se adjunta a cada registro como un dato más para el motor.
  if (senales && extra.usarNotasIA !== false) lote = lote.map((r) => { const x = r.notas ? senales.get(r.notas.trim()) : undefined; return x ? { ...r, senales: x } : r; });
  // Es reasignación solo si algún registro del lote ya tenía trabajo encima; repartir "nuevos" elegidos a mano no lo es.
  const reasigna = lote.some((r) => r.estado !== "nuevo");

  // La carga no cuenta los registros que se están moviendo (liberan cupo a su dueño actual).
  const idsLote = new Set(lote.map((r) => r.id));
  const cargaInicial = calcularCarga(base.registros.filter((r) => !idsLote.has(r.id)), base.actividad, base.vigentes);
  const params = parametros(fecha, extra);
  const datos: DatosMotor = { registros: lote, usuarios: base.usuarios, ausencias: base.ausencias, cargaInicial };
  return { datos, params, reasigna, duenos, cargaInicial, tipo: reasigna ? ("reasignacion" as const) : ("asignacion" as const) };
}

/** Método determinista sobre el lote armado. */
export function planificar(base: Base, sol: Solicitud, senales?: Map<string, SenalesNota>) {
  if (sol.metodo === "ia") throw new ErrorNegocio("El método de IA se previsualiza con previsualizar() y se ejecuta con su preview_id.");
  const l = armarLote(base, sol, senales);
  return { ...l, resultado: proponer(sol.metodo, l.datos, l.params) };
}

/** Lee (o toma del caché) las notas del lote. Nunca detiene el reparto: si falla, devuelve avisos. */
export async function leerNotasDelLote(base: Base, sol: Solicitud) {
  if (sol.parametros?.usarNotasIA === false) return { senales: undefined, avisos: [] as string[], distintas: 0, nuevas: 0 };
  const { datos } = armarLote(base, sol);
  const r = await leerSenales(datos.registros.map((x) => x.notas));
  return { senales: r.mapa, avisos: r.avisos, distintas: r.distintas, nuevas: r.nuevas };
}

export async function previsualizar(sol: Solicitud) {
  const base = await leerTodo();
  const lectura = await leerNotasDelLote(base, sol);
  let resultado: ResultadoMotor;
  let sin_procesar = 0;
  let preview_id: string | undefined;
  const { cargaInicial, duenos, datos, params } = armarLote(base, sol, lectura.senales);
  if (sol.metodo === "ia") {
    const limite = Math.min(Math.max(Math.trunc(sol.ia?.limite ?? LIMITE_IA_DEFECTO), 1), LIMITE_IA_MAXIMO);
    const r = await proponerIA(datos, params, limite);
    sin_procesar = r.sin_procesar;
    resultado = r;
    preview_id = (ok(await db().from("previsualizaciones").insert({ metodo: "ia", solicitud: sol as never, resultado: r as never } as never).select("id").single(), "guardar previsualización") as unknown as { id: string }).id;
  } else {
    resultado = proponer(sol.metodo, datos, params);
  }
  return {
    ...resultado, cargaInicial, preview_id, sin_procesar,
    avisos: lectura.avisos, notas: { distintas: lectura.distintas, nuevas: lectura.nuevas },
    propuestas: resultado.propuestas.map((p) => ({ ...p, dueno_actual: duenos.get(p.registro_id) ?? null })),
    resumen: {
      asignables: resultado.propuestas.filter((p) => p.usuario_id !== null).length,
      sin_candidato: resultado.propuestas.filter((p) => p.usuario_id === null).length,
      retenidos: resultado.retenidos.length,
    },
  };
}

/** Quién ejecuta: debe ser un admin o líder activo. Queda como texto legible en la traza. */
export async function resolverActor(actorId: unknown): Promise<string> {
  const id = Number(actorId);
  if (!Number.isInteger(id)) throw new ErrorNegocio("Falta indicar quién ejecuta (ejecutado_por).");
  const u = ok(await db().from("usuarios").select("id,nombre,rol,activo").eq("id", id).maybeSingle(), "actor") as unknown as
    Pick<Usuario, "id" | "nombre" | "rol" | "activo"> | null;
  if (!u || !u.activo || !["admin", "lider"].includes(u.rol)) throw new ErrorNegocio("Solo un admin o líder activo puede ejecutar asignaciones.");
  return `${u.nombre} (${u.rol} #${u.id})`;
}

interface FilaNueva {
  registro_id: number; usuario_id: number; motivo: string; candidatos: EvaluacionCandidato[];
  banderas_decision?: string[]; dueno_anterior?: number | null; senales?: SenalesNota;
  prompt_enviado?: string; respuesta_modelo?: string; modelo?: string;
}

/**
 * Escribe la traza: una ejecución + una asignación por registro. Las vigentes anteriores se
 * marcan no vigentes (nunca se sobrescriben) y la nueva apunta a ellas en `reemplaza_a`.
 * supabase-js no tiene transacciones: si algo falla se deshace lo ya escrito.
 */
export async function persistir(
  meta: { tipo: "asignacion" | "reasignacion"; metodo: string; parametros: unknown; actor: string; fecha: string },
  filas: FilaNueva[],
  vigentes: FilaAsignacion[],
) {
  const c = db();
  const ej = ok(await c.from("ejecuciones").insert({
    tipo: meta.tipo, metodo: meta.metodo, parametros: meta.parametros as never, ejecutado_por: meta.actor,
    fecha_referencia: meta.fecha, total_registros: filas.length,
  } as never).select("id").single(), "ejecución") as unknown as { id: string };

  const previas = new Map(vigentes.map((v) => [v.registro_id, v]));
  const aReemplazar = filas.map((f) => previas.get(f.registro_id)).filter((x): x is FilaAsignacion => !!x);
  const revertir = async () => {
    if (aReemplazar.length) await c.from("asignaciones").update({ vigente: true } as never).in("id", aReemplazar.map((x) => x.id));
    await c.from("asignaciones").delete().eq("ejecucion_id", ej.id);
    await c.from("ejecuciones").delete().eq("id", ej.id);
  };

  try {
    if (aReemplazar.length) {
      ok(await c.from("asignaciones").update({ vigente: false } as never).in("id", aReemplazar.map((x) => x.id)), "cerrar vigentes");
    }
    const rows = filas.map((f) => ({
      ejecucion_id: ej.id, registro_id: f.registro_id, usuario_id: f.usuario_id, metodo: meta.metodo,
      parametros: { ...(meta.parametros as object), dueno_anterior_usuario_id: f.dueno_anterior ?? null, banderas_decision: f.banderas_decision ?? [], senales_nota: f.senales ?? null },
      ejecutado_por: meta.actor, reemplaza_a: previas.get(f.registro_id)?.id ?? null, vigente: true,
      motivo: f.motivo, candidatos: f.candidatos, prompt_enviado: f.prompt_enviado ?? null,
      respuesta_modelo: f.respuesta_modelo ?? null, modelo: f.modelo ?? null,
    }));
    if (rows.length) ok(await c.from("asignaciones").insert(rows as never), "insertar asignaciones");
    const nuevos = filas.map((f) => f.registro_id);
    if (nuevos.length) ok(await c.from("registros").update({ estado: "asignado" } as never).in("id", nuevos).eq("estado", "nuevo"), "estado registros");
  } catch (e) {
    await revertir();
    throw e;
  }
  return ej.id;
}

/** Recupera una previsualización de IA vigente (1 h) y aún no usada. */
async function leerPreview(id: unknown): Promise<{ solicitud: Solicitud; resultado: ResultadoMotor }> {
  if (typeof id !== "string") throw new ErrorNegocio("El método de IA se ejecuta sobre una previsualización: falta preview_id.");
  const r = ok(await db().from("previsualizaciones").select("*").eq("id", id).maybeSingle(), "previsualización") as unknown as
    { solicitud: Solicitud; resultado: ResultadoMotor; creada_en: string; usada_en: string | null } | null;
  if (!r) throw new ErrorNegocio("La previsualización no existe.");
  if (r.usada_en) throw new ErrorNegocio("Esa previsualización ya se ejecutó.");
  if (Date.now() - Date.parse(r.creada_en) > 3_600_000) throw new ErrorNegocio("La previsualización venció (1 hora). Genera otra.");
  return r;
}

export async function ejecutar(sol: Solicitud, actorId: unknown, previewId?: unknown) {
  const actor = await resolverActor(actorId);
  const base = await leerTodo();
  let filas: FilaNueva[];
  let meta: Parameters<typeof persistir>[0];
  let sinCandidato: number;
  let retenidos: ResultadoMotor["retenidos"];
  const lectura = await leerNotasDelLote(base, sol);
  const l = armarLote(base, sol, lectura.senales);

  if (sol.metodo === "ia") {
    // El modelo no es determinista: se ejecuta lo previsualizado (con su prompt y respuesta), no una consulta nueva.
    const prev = await leerPreview(previewId);
    const carga = { ...l.cargaInicial };
    const ctx = { ausencias: base.ausencias, carga, params: l.params };
    const reg = new Map(l.datos.registros.map((r) => [r.id, r]));
    const usuarios = new Map(base.usuarios.map((u) => [u.id, u]));
    const validas = prev.resultado.propuestas.filter((p) => p.usuario_id !== null);
    for (const p of validas) {
      const r = reg.get(p.registro_id), u = usuarios.get(p.usuario_id!);
      // Entre la previsualización y ahora pudo cambiar algo (otro reparto, una ausencia nueva...): se revalida.
      const ev = r && u ? evaluarCandidato(u, r, ctx, true) : null;
      if (!r || !ev?.elegible || razonesRetencion(r, l.params).length) {
        throw new ErrorNegocio(`Los datos cambiaron desde la previsualización (registro #${p.registro_id}). Genera una nueva previsualización.`);
      }
      carga[u!.id] = (carga[u!.id] ?? 0) + 1;
    }
    filas = validas.map((p) => ({
      registro_id: p.registro_id, usuario_id: p.usuario_id!, motivo: p.motivo, candidatos: p.candidatos,
      banderas_decision: p.banderas_decision, dueno_anterior: l.duenos.get(p.registro_id) ?? null, senales: p.senales,
      prompt_enviado: p.prompt_enviado, respuesta_modelo: p.respuesta_modelo, modelo: p.modelo,
    }));
    sinCandidato = prev.resultado.propuestas.length - filas.length;
    retenidos = prev.resultado.retenidos;
    meta = { tipo: l.tipo, metodo: "ia", parametros: { ...prev.resultado.parametros, ia: { modelo: MODELO_IA, prompt: PROMPT_VERSION, limite: sol.ia?.limite ?? LIMITE_IA_DEFECTO, preview_id: previewId } }, actor, fecha: prev.resultado.parametros.fechaReferencia };
  } else {
    const { resultado } = planificar(base, sol, lectura.senales);
    filas = resultado.propuestas.filter((p) => p.usuario_id !== null).map((p) => ({
      registro_id: p.registro_id, usuario_id: p.usuario_id!, motivo: p.motivo, candidatos: p.candidatos,
      banderas_decision: p.banderas_decision, dueno_anterior: l.duenos.get(p.registro_id) ?? null, senales: p.senales,
    }));
    sinCandidato = resultado.propuestas.length - filas.length;
    retenidos = resultado.retenidos;
    meta = { tipo: l.tipo, metodo: resultado.metodo, parametros: resultado.parametros, actor, fecha: resultado.parametros.fechaReferencia };
  }

  if (!filas.length) throw new ErrorNegocio("No hay nada que asignar con esta configuración.", { retenidos: retenidos.length, sin_candidato: sinCandidato });
  const id = await persistir(meta, filas, base.vigentes);
  if (sol.metodo === "ia") await db().from("previsualizaciones").update({ usada_en: new Date().toISOString() } as never).eq("id", previewId as string);
  return { ejecucion_id: id, asignados: filas.length, sin_candidato: sinCandidato, retenidos };
}

/** Reasignación manual de un registro a un vendedor concreto, con motivo obligatorio. */
export async function reasignarManual(
  input: { registro_id: number; usuario_id: number; motivo: string; fechaReferencia?: string }, actorId: unknown,
) {
  const motivo = (input.motivo ?? "").trim();
  if (motivo.length < 5) throw new ErrorNegocio("La reasignación manual necesita un motivo (mínimo 5 caracteres).");
  const actor = await resolverActor(actorId);
  const base = await leerTodo();
  const reg = base.registros.find((r) => r.id === input.registro_id);
  const dest = base.usuarios.find((u) => u.id === input.usuario_id);
  if (!reg) throw new ErrorNegocio("El registro no existe.");
  if (!dest) throw new ErrorNegocio("El usuario destino no existe.");
  if (reg.estado === "descartado") throw new ErrorNegocio("Un registro descartado no se puede asignar.");

  const duenos = duenosActuales(base.actividad, base.vigentes);
  if (duenos.get(reg.id) === dest.id) throw new ErrorNegocio("El registro ya está con ese vendedor.");
  const fecha = input.fechaReferencia ?? hoy();
  const params = parametros(fecha, { zona: "ignorar" }); // el coordinador puede saltarse la zona; lo demás no
  const carga = calcularCarga(base.registros.filter((r) => r.id !== reg.id), base.actividad, base.vigentes);
  const ev = evaluarCandidato(dest, reg, { ausencias: base.ausencias, carga, params });
  if (!ev.elegible) throw new ErrorNegocio(`${dest.nombre} no puede recibir el registro: ${ev.descartes.join(", ")}`, ev);

  const id = await persistir(
    { tipo: "reasignacion", metodo: "manual", parametros: params, actor, fecha },
    [{ registro_id: reg.id, usuario_id: dest.id, motivo: `Reasignación manual: ${motivo}`, candidatos: [ev], dueno_anterior: duenos.get(reg.id) ?? null }],
    base.vigentes,
  );
  return { ejecucion_id: id };
}

/** Todo lo que se sabe de un registro: sus datos, su dueño actual y la cadena de asignaciones. */
export async function trazaDeRegistro(registroId: number) {
  const c = db();
  const [reg, asigs, act] = await Promise.all([
    c.from("registros").select("*").eq("id", registroId).maybeSingle(),
    c.from("asignaciones").select("*, usuarios(id,nombre,rol), ejecuciones(tipo,metodo,parametros,ejecutado_por,creada_en)")
      .eq("registro_id", registroId).order("creada_en", { ascending: true }),
    c.from("actividad").select("*").eq("registro_id", registroId).order("fecha", { ascending: true }),
  ]);
  const registro = ok(reg, "registro");
  if (!registro) throw new ErrorNegocio("El registro no existe.");
  return { registro, asignaciones: ok(asigs, "asignaciones"), actividad: ok(act, "actividad") };
}

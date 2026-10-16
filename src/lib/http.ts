import { ErrorAuth, ErrorNegocio } from "./db";
import type { Solicitud } from "./servicio";

/** Ejecuta un handler y traduce errores: de negocio → 400, el resto → 500 sin filtrar detalles internos. */
export async function responder(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn());
  } catch (e) {
    if (e instanceof ErrorAuth) return Response.json({ error: e.message }, { status: e.estado });
    if (e instanceof ErrorNegocio) return Response.json({ error: e.message, detalle: e.detalle }, { status: 400 });
    console.error(e);
    return Response.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

export async function cuerpo(req: Request): Promise<Record<string, unknown>> {
  try { return (await req.json()) as Record<string, unknown>; } catch { throw new ErrorNegocio("El cuerpo debe ser JSON válido."); }
}

const METODOS = ["round_robin", "balanceo_carga", "reglas", "ia"];
export function validarSolicitud(b: Record<string, unknown>): Solicitud {
  if (!METODOS.includes(String(b.metodo))) throw new ErrorNegocio(`Método inválido. Opciones: ${METODOS.join(", ")}.`);
  const a = (b.alcance ?? { tipo: "pendientes" }) as { tipo?: string; usuario_id?: unknown; ids?: unknown };
  let alcance: Solicitud["alcance"];
  if (a.tipo === "pendientes") alcance = { tipo: "pendientes" };
  else if (a.tipo === "usuario" && Number.isInteger(a.usuario_id)) alcance = { tipo: "usuario", usuario_id: a.usuario_id as number };
  else if (a.tipo === "registros" && Array.isArray(a.ids) && a.ids.length && a.ids.every(Number.isInteger)) alcance = { tipo: "registros", ids: a.ids as number[] };
  else throw new ErrorNegocio("Alcance inválido: use pendientes, usuario{usuario_id} o registros{ids}.");
  const f = b.fechaReferencia;
  if (f !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(f))) throw new ErrorNegocio("fechaReferencia debe ser AAAA-MM-DD.");
  return { metodo: b.metodo as Solicitud["metodo"], alcance, parametros: (b.parametros ?? {}) as Solicitud["parametros"], ia: b.ia as Solicitud["ia"], fechaReferencia: f as string | undefined };
}

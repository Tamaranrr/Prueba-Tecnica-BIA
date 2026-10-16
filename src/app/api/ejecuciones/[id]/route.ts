import { db, ok } from "@/lib/db";
import { responder } from "@/lib/http";
import { requerirSesion } from "@/lib/sesion";

// Qué asignó exactamente una ejecución: un renglón por registro, con su motivo y si es vigente.
export const GET = (req: Request, ctx: RouteContext<"/api/ejecuciones/[id]">) =>
  responder(async () => {
    await requerirSesion(req);
    const { id } = await ctx.params;
    return ok(await db().from("asignaciones")
      .select("id,registro_id,vigente,motivo,modelo,reemplaza_a,registros(razon_social,zona),usuarios(nombre)")
      .eq("ejecucion_id", id).order("registro_id"), "asignaciones de la ejecución");
  });

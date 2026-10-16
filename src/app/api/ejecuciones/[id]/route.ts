import { db, ok } from "@/lib/db";
import { responder } from "@/lib/http";

// Qué asignó exactamente una ejecución: un renglón por registro, con su motivo y si es vigente.
export const GET = (_req: Request, ctx: RouteContext<"/api/ejecuciones/[id]">) =>
  responder(async () => {
    const { id } = await ctx.params;
    return ok(await db().from("asignaciones")
      .select("id,registro_id,vigente,motivo,modelo,reemplaza_a,registros(razon_social,zona),usuarios(nombre)")
      .eq("ejecucion_id", id).order("registro_id"), "asignaciones de la ejecución");
  });

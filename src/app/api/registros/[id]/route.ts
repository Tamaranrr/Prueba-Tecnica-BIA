import { ErrorNegocio } from "@/lib/db";
import { responder } from "@/lib/http";
import { requerirSesion } from "@/lib/sesion";
import { trazaDeRegistro } from "@/lib/servicio";

// "¿Por qué este registro terminó acá?": datos, actividad y toda la cadena de asignaciones.
export const GET = (req: Request, ctx: RouteContext<"/api/registros/[id]">) =>
  responder(async () => {
    await requerirSesion(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new ErrorNegocio("Id inválido.");
    return trazaDeRegistro(id);
  });

import { cuerpo, responder, validarSolicitud } from "@/lib/http";
import { requerirSesion } from "@/lib/sesion";
import { ejecutar } from "@/lib/servicio";

// Ejecuta el reparto y escribe la traza. Quien ejecuta sale de la sesión, no del cuerpo de la petición.
export const POST = (req: Request) =>
  responder(async () => {
    const ses = await requerirSesion(req);
    const b = await cuerpo(req);
    return ejecutar(validarSolicitud(b), ses.id, b.preview_id);
  });

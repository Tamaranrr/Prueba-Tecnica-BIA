import { cuerpo, responder, validarSolicitud } from "@/lib/http";
import { ejecutar } from "@/lib/servicio";

// Ejecuta el reparto y escribe la traza. Requiere ejecutado_por (admin o líder activo).
export const POST = (req: Request) =>
  responder(async () => {
    const b = await cuerpo(req);
    return ejecutar(validarSolicitud(b), b.ejecutado_por, b.preview_id);
  });

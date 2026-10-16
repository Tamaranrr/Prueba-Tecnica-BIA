import { responder } from "@/lib/http";
import { requerirSesion } from "@/lib/sesion";
import { compararMetodos } from "@/lib/servicio";

// Compara los métodos sobre los mismos pendientes. Solo lee: no escribe y no llama al modelo.
export const GET = (req: Request) =>
  responder(async () => {
    await requerirSesion(req);
    const f = new URL(req.url).searchParams.get("fecha");
    return compararMetodos(f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : undefined);
  });

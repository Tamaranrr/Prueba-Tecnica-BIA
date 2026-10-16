import { db, ok } from "@/lib/db";
import { responder } from "@/lib/http";
import { requerirSesion } from "@/lib/sesion";

// Historial de ejecuciones (más recientes primero) para la pantalla de auditoría.
export const GET = (req: Request) =>
  responder(async () => {
    await requerirSesion(req);
    return ok(await db().from("ejecuciones").select("*").order("creada_en", { ascending: false }).limit(100), "ejecuciones");
  });

import { db, ok } from "@/lib/db";
import { responder } from "@/lib/http";

// Historial de ejecuciones (más recientes primero) para la pantalla de auditoría.
export const GET = () =>
  responder(async () =>
    ok(await db().from("ejecuciones").select("*").order("creada_en", { ascending: false }).limit(100), "ejecuciones"));

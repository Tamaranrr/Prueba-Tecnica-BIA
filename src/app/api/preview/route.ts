import { cuerpo, responder, validarSolicitud } from "@/lib/http";
import { previsualizar } from "@/lib/servicio";

// Simula el reparto sin escribir nada.
export const POST = (req: Request) => responder(async () => previsualizar(validarSolicitud(await cuerpo(req))));

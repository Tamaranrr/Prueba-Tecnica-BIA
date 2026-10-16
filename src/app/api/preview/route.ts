import { cuerpo, responder, validarSolicitud } from "@/lib/http";
import { previsualizar } from "@/lib/servicio";

export const maxDuration = 300; // el método de IA consulta al modelo registro por registro

// Simula el reparto sin escribir nada.
export const POST = (req: Request) => responder(async () => previsualizar(validarSolicitud(await cuerpo(req))));

import { ErrorAuth, ErrorNegocio } from "@/lib/db";
import { cuerpo, responder, validarSolicitud } from "@/lib/http";
import { requerirSesion } from "@/lib/sesion";
import { previsualizar } from "@/lib/servicio";

export const maxDuration = 300; // repartir todo con IA: consultas en olas, alrededor de un minuto

/**
 * "Repartir todo con IA": igual que /api/preview pero sin tope de registros y con progreso en vivo.
 * Responde en líneas JSON (una por evento): {tipo:"progreso",hechos,total} ... y al final {tipo:"fin",resultado} o {tipo:"error",mensaje}.
 */
export async function POST(req: Request) {
  let sol;
  try {
    await requerirSesion(req);
    sol = validarSolicitud(await cuerpo(req));
    if (sol.metodo !== "ia") throw new ErrorNegocio("Repartir todo solo existe para el método de IA.");
    sol = { ...sol, ia: { ...sol.ia, todo: true } };
  } catch (e) {
    return responder(async () => { throw e; });   // 400, 401 o 500 con el mismo formato de las demás rutas
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const resultado = await previsualizar(sol, { alAvanzar: (hechos, total) => enviar({ tipo: "progreso", hechos, total }) });
        enviar({ tipo: "fin", resultado });
      } catch (e) {
        if (!(e instanceof ErrorNegocio || e instanceof ErrorAuth)) console.error(e);
        enviar({ tipo: "error", mensaje: e instanceof ErrorNegocio || e instanceof ErrorAuth ? e.message : "Error interno del servidor." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

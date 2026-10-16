import { cuerpo, responder } from "@/lib/http";
import { reasignarManual } from "@/lib/servicio";

// Reasignación manual de un registro a un vendedor, con motivo obligatorio.
export const POST = (req: Request) =>
  responder(async () => {
    const b = await cuerpo(req);
    return reasignarManual(
      { registro_id: Number(b.registro_id), usuario_id: Number(b.usuario_id), motivo: String(b.motivo ?? ""), fechaReferencia: b.fechaReferencia as string | undefined },
      b.ejecutado_por,
    );
  });

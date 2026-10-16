import { calcularCarga, duenosActuales } from "@/lib/engine/carga";
import { ausenciaVigente } from "@/lib/engine/filtros";
import { segmentoDe } from "@/lib/engine/segmento";
import { responder } from "@/lib/http";
import { hoy, leerTodo } from "@/lib/servicio";

// Datos para la consola: pendientes, equipo con su carga y registros en poder de cada vendedor.
export const GET = (req: Request) =>
  responder(async () => {
    const fecha = new URL(req.url).searchParams.get("fecha") ?? hoy();
    const b = await leerTodo();
    const carga = calcularCarga(b.registros, b.actividad, b.vigentes);
    const duenos = duenosActuales(b.actividad, b.vigentes);
    return {
      fecha,
      usuarios: b.usuarios.map((u) => ({
        ...u, carga: carga[u.id] ?? 0, ausencia: ausenciaVigente(b.ausencias, u.id, fecha) ?? null,
      })),
      registros: b.registros.map((r) => ({ ...r, segmento: segmentoDe(r), dueno_id: duenos.get(r.id) ?? null })),
    };
  });

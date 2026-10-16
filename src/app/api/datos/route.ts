import { calcularCarga, duenosActuales } from "@/lib/engine/carga";
import { calcularPerfiles, resumenDe } from "@/lib/engine/cartera";
import { ausenciaProxima, ausenciaVigente, capacidadEfectiva } from "@/lib/engine/filtros";
import { segmentoDe } from "@/lib/engine/segmento";
import { PARAMETROS_DEFECTO } from "@/lib/engine/tipos";
import { responder } from "@/lib/http";
import { requerirSesion } from "@/lib/sesion";
import { fechaOperacion, hoy, leerTodo } from "@/lib/servicio";

// Datos para la consola: pendientes, equipo con su cartera y registros en poder de cada vendedor.
export const GET = (req: Request) =>
  responder(async () => {
    await requerirSesion(req);
    const b = await leerTodo();
    const fechaDatos = fechaOperacion(b);
    const fecha = new URL(req.url).searchParams.get("fecha") || fechaDatos;
    const carga = calcularCarga(b.registros, b.actividad, b.vigentes);
    const duenos = duenosActuales(b.actividad, b.vigentes);
    const perfiles = calcularPerfiles(b.usuarios, b.registros, b.actividad, duenos, b.vigentes, fecha);
    return {
      fecha,
      // La fecha de los datos (último movimiento registrado) y la del reloj: la consola avisa cuando difieren.
      fecha_datos: fechaDatos,
      fecha_reloj: hoy(),
      usuarios: b.usuarios.map((u) => {
        const cap = capacidadEfectiva(u, fecha, PARAMETROS_DEFECTO.capacidadRampa);
        return {
          ...u, carga: carga[u.id] ?? 0,
          capacidad_efectiva: cap.capacidad, capacidad_provisional: cap.provisional,
          ausencia: ausenciaVigente(b.ausencias, u.id, fecha) ?? null,
          ausencia_proxima: ausenciaProxima(b.ausencias, u.id, fecha, PARAMETROS_DEFECTO.ventanaAusenciaDias) ?? null,
          perfil: resumenDe(perfiles[u.id]),
        };
      }),
      registros: b.registros.map((r) => ({ ...r, segmento: segmentoDe(r), dueno_id: duenos.get(r.id) ?? null })),
    };
  });

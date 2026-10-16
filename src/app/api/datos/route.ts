import { calcularCarga, duenosActuales } from "@/lib/engine/carga";
import { calcularPerfiles, resumenDe } from "@/lib/engine/cartera";
import { explicarAsignacion } from "@/lib/engine/explicar";
import { ausenciaProxima, ausenciaVigente, capacidadEfectiva } from "@/lib/engine/filtros";
import { prepararLote } from "@/lib/engine/motor";
import { razonPrioridad } from "@/lib/engine/prioridad";
import { segmentoDe } from "@/lib/engine/segmento";
import { PARAMETROS_DEFECTO, type EvaluacionCandidato } from "@/lib/engine/tipos";
import { db, ok } from "@/lib/db";
import { responder } from "@/lib/http";
import { leerSenalesEnCache } from "@/lib/notasServicio";
import { requerirSesion } from "@/lib/sesion";
import { armarLote, fechaOperacion, hoy, leerTodo } from "@/lib/servicio";

interface FilaAsignacion {
  registro_id: number; usuario_id: number; metodo: string; motivo: string | null; creada_en: string;
  ejecutado_por: string; ejecucion_id: string; candidatos: EvaluacionCandidato[] | null;
}

// Datos para la consola: pendientes con su prioridad, equipo con su cartera y, por registro, a quién se le asignó y por qué.
export const GET = (req: Request) =>
  responder(async () => {
    await requerirSesion(req);
    const b = await leerTodo();
    const fechaDatos = fechaOperacion(b);
    const fecha = new URL(req.url).searchParams.get("fecha") || fechaDatos;
    const carga = calcularCarga(b.registros, b.actividad, b.vigentes);
    const duenos = duenosActuales(b.actividad, b.vigentes);
    const perfiles = calcularPerfiles(b.usuarios, b.registros, b.actividad, duenos, b.vigentes, fecha);

    // Prioridad: el mismo orden y los mismos retenidos que usaría un reparto hoy (solo lee el caché de notas: no llama al modelo).
    const senales = await leerSenalesEnCache(b.registros.filter((r) => r.estado === "nuevo").map((r) => r.notas));
    const lote = armarLote(b, { metodo: "reglas", alcance: { tipo: "pendientes" }, fechaReferencia: fecha }, senales);
    const prep = prepararLote("reglas", lote.datos, lote.params);
    const prioridad = new Map(prep.porAsignar.map((r, i) => [r.id, { posicion: i + 1, razon: razonPrioridad(r, lote.params, fecha) }]));
    const retenidos = new Map(prep.retenidos.map((x) => [x.registro_id, x.razones]));

    // A quién se le asignó cada registro, quién lo hizo y por qué (en lenguaje simple).
    const c = db();
    const [asg, ult] = await Promise.all([
      c.from("asignaciones").select("registro_id,usuario_id,metodo,motivo,creada_en,ejecutado_por,ejecucion_id,candidatos").eq("vigente", true),
      c.from("ejecuciones").select("id,tipo,metodo,ejecutado_por,creada_en,total_registros").order("creada_en", { ascending: false }).limit(1),
    ]);
    const asignaciones = new Map((ok(asg, "asignaciones") as unknown as FilaAsignacion[]).map((a) => [a.registro_id, {
      usuario_id: a.usuario_id, metodo: a.metodo, por: a.ejecutado_por, cuando: a.creada_en, ejecucion_id: a.ejecucion_id,
      explicacion: explicarAsignacion({ metodo: a.metodo, motivo: a.motivo, usuario_id: a.usuario_id, candidatos: a.candidatos }),
    }]));

    return {
      fecha,
      // La fecha de los datos (último movimiento registrado) y la del reloj: la consola avisa cuando difieren.
      fecha_datos: fechaDatos,
      fecha_reloj: hoy(),
      ultima_ejecucion: (ok(ult, "ejecuciones") as unknown as unknown[])[0] ?? null,
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
      registros: b.registros.map((r) => ({
        ...r, segmento: segmentoDe(r), dueno_id: duenos.get(r.id) ?? null,
        prioridad: prioridad.get(r.id) ?? null, retenido: retenidos.get(r.id) ?? null, asignacion: asignaciones.get(r.id) ?? null,
      })),
    };
  });

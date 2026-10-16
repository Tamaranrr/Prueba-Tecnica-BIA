"use client";

import { useState } from "react";
import type { Datos } from "@/lib/cliente";
import { TablaRegistros } from "./TablaRegistros";
import { Badge, boton, Tarjeta } from "./ui";

const METODO: Record<string, string> = { ia: "IA", reglas: "reglas", balanceo_carga: "balanceo de carga", round_robin: "round-robin", manual: "manual" };
const soloNombre = (s: string) => s.replace(/\s*\(.*\)\s*$/, "");
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

export function Registros({ datos, seleccion, setSeleccion, abrir, irARepartir, irAAuditoria }: {
  datos: Datos; seleccion: Set<number>; setSeleccion: (s: Set<number>) => void; abrir: (id: number) => void;
  irARepartir: () => void; irAAuditoria: () => void;
}) {
  const [soloUltimo, setSoloUltimo] = useState(false);
  const u = datos.ultima_ejecucion;
  const vigentes = u ? datos.registros.filter((r) => r.asignacion?.ejecucion_id === u.id).length : 0;
  return (
    <div className="space-y-4">
      {u && (
        <section aria-label="Último reparto" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <p>
            <Badge tono="azul">último reparto</Badge>{" "}
            <b>{u.total_registros}</b> {u.total_registros === 1 ? "registro" : "registros"} por <b>{soloNombre(u.ejecutado_por)}</b>, método <b>{METODO[u.metodo] ?? u.metodo}</b>, {fechaHora(u.creada_en)}
            {vigentes < u.total_registros && <span className="text-blue-800"> ({vigentes} siguen con esa asignación; el resto se reasignó después)</span>}
          </p>
          <span className="flex gap-2">
            <button className={boton(soloUltimo ? "primario" : "secundario")} aria-pressed={soloUltimo} onClick={() => setSoloUltimo((x) => !x)}>
              {soloUltimo ? "Mostrar todos" : "Ver solo estos"}
            </button>
            <button className={boton()} onClick={irAAuditoria}>Ver detalle en Auditoría</button>
          </span>
        </section>
      )}
      <Tarjeta>
        <TablaRegistros datos={datos} base={datos.registros} seleccion={seleccion} setSeleccion={setSeleccion} abrir={abrir} alto="38rem"
          soloEjecucion={soloUltimo && u ? u.id : null}
          acciones={seleccion.size > 0 ? <button className={boton("primario")} onClick={irARepartir}>Repartir los {seleccion.size} seleccionados</button> : null} />
      </Tarjeta>
    </div>
  );
}

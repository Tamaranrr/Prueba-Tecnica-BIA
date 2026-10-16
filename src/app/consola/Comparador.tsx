"use client";

import { useEffect, useState } from "react";
import { api, fmtFecha, METODOS, type Comparacion, type Medicion } from "@/lib/cliente";
import { Badge, boton, Tarjeta, Titulo } from "./ui";

const nombreMetodo = (id: string) => METODOS.find((m) => m.id === id)?.nombre ?? id;

/** Qué columna gana en cada fila: "max" = más es mejor, "min" = menos es mejor. */
const FILAS: { clave: keyof Medicion; etiqueta: string; ayuda: string; mejor?: "max" | "min"; formato?: (m: Medicion) => string }[] = [
  { clave: "asignados", etiqueta: "Asignados", ayuda: "Registros que quedan con un vendedor." },
  { clave: "retenidos", etiqueta: "Retenidos", ayuda: "Duplicados y quienes pidieron no insistir: esperan una decisión humana.", mejor: "min" },
  { clave: "sin_candidato", etiqueta: "Sin candidato válido", ayuda: "Ningún vendedor pasó los filtros duros.", mejor: "min" },
  { clave: "pct_segmento", etiqueta: "Con experto de su segmento", ayuda: "% de lo asignado que fue a alguien especializado en ese segmento.", mejor: "max", formato: (m) => (m.pct_segmento === null ? "n/a" : `${m.pct_segmento}%`) },
  { clave: "pct_zona", etiqueta: "En su zona", ayuda: "% de lo asignado que fue a un vendedor de la misma zona.", mejor: "max", formato: (m) => (m.pct_zona === null ? "n/a" : `${m.pct_zona}%`) },
  { clave: "grandes_con_experto", etiqueta: "Cuentas grandes con experto corporativo", ayuda: "Cuentas corporativas que fueron a un experto corporativo.", mejor: "max", formato: (m) => `${m.grandes_con_experto} de ${m.grandes}` },
  { clave: "personas_con_grandes", etiqueta: "Personas que reciben cuentas grandes", ayuda: "Cuantas más, menos concentración de las cuentas más valiosas.", mejor: "max" },
  { clave: "ocupacion_maxima", etiqueta: "Ocupación del más cargado", ayuda: "Carga sobre capacidad del vendedor más lleno después del reparto.", mejor: "min", formato: (m) => `${m.ocupacion_maxima}%` },
  { clave: "desbalance", etiqueta: "Desbalance entre vendedores", ayuda: "Desviación de la ocupación, en puntos. Menos es más parejo.", mejor: "min", formato: (m) => `${m.desbalance.toFixed(1)} pts` },
  { clave: "reglas_rotas", etiqueta: "Reglas duras rotas", ayuda: "Ausentes, inactivos, sin capacidad, cuentas grandes a quien lleva menos de 2 años, rampa en cuentas no pyme. Siempre debe ser 0.", mejor: "min" },
];

export function Comparador({ fecha, irARepartir }: { fecha: string; irARepartir: () => void }) {
  const [c, setC] = useState<Comparacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);   // sube al pulsar "Recalcular"
  const [hecha, setHecha] = useState(-1);     // última vuelta que terminó
  const cargando = hecha !== vuelta;
  useEffect(() => {
    let vigente = true;
    api<Comparacion>(`/api/comparar?fecha=${fecha}`)
      .then((r) => { if (vigente) { setC(r); setError(null); } })
      .catch((e: Error) => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setHecha(vuelta); });
    return () => { vigente = false; };
  }, [fecha, vuelta]);
  const cargar = () => setVuelta((v) => v + 1);

  if (error) return <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-800">No se pudo comparar: {error}</p>;
  if (!c) return <p className="text-slate-500">Calculando los métodos sobre los mismos pendientes…</p>;

  const ia = c.filas.find((f) => f.metodo === "ia");
  const ganador = (clave: keyof Medicion, mejor?: "max" | "min") => {
    if (!mejor) return null;
    const v = c.filas.map((f) => (f.medicion[clave] as number | null) ?? null).filter((x): x is number => x !== null);
    return v.length ? (mejor === "max" ? Math.max(...v) : Math.min(...v)) : null;
  };

  return (
    <div className="space-y-4">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <Titulo>Mismos {c.pendientes} pendientes, cuatro formas de repartirlos</Titulo>
            <p className="text-sm text-slate-600">
              Cada columna reparte exactamente los mismos registros con las mismas reglas duras. No se guarda nada. Lo que cambia es el criterio:
              los dos métodos simples no miran la especialidad; las reglas y la IA sí. En <b className="text-emerald-700">verde</b> el mejor valor de cada fila (empates incluidos).
            </p>
          </div>
          <div className="flex gap-2">
            <button className={boton()} disabled={cargando} onClick={cargar}>{cargando ? "Calculando…" : "Recalcular"}</button>
            <button className={boton("primario")} onClick={irARepartir}>Ir a repartir</button>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta className="overflow-x-auto !p-0">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">Medida</th>
              {c.filas.map((f) => <th key={f.metodo} className="px-4 py-3 text-right font-semibold">{nombreMetodo(f.metodo)}</th>)}
              {!ia && <th className="px-4 py-3 text-right font-semibold text-slate-400">Asignación por IA</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {FILAS.map((fila) => {
              const mejor = ganador(fila.clave, fila.mejor);
              return (
                <tr key={fila.clave}>
                  <td className="px-4 py-2.5"><p className="font-medium text-slate-800">{fila.etiqueta}</p><p className="text-xs text-slate-500">{fila.ayuda}</p></td>
                  {c.filas.map((f) => {
                    const m = f.medicion, v = m[fila.clave] as number | null;
                    const gana = mejor !== null && v === mejor && c.filas.some((o) => (o.medicion[fila.clave] as number | null) !== mejor);
                    const roto = fila.clave === "reglas_rotas" && (v ?? 0) > 0;
                    return (
                      <td key={f.metodo} className={`px-4 py-2.5 text-right tabular-nums ${roto ? "font-bold text-rose-700" : gana ? "font-semibold text-emerald-700" : "text-slate-800"}`}>
                        {fila.formato ? fila.formato(m) : (v ?? "n/a")}
                      </td>
                    );
                  })}
                  {!ia && <td className="px-4 py-2.5 text-right text-slate-300">sin datos</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta className="!p-4 text-sm text-slate-600">
        {ia ? (
          <p>
            <Badge tono="marca">IA</Badge> Su columna sale de la última previsualización guardada ({fmtFecha(ia.origen!.creada_en)}), porque consultar al modelo cuesta tiempo y dinero.
            {!ia.origen!.misma_fecha && <b className="text-amber-700"> Se hizo con otra fecha de operación: no es del todo comparable.</b>}
            {ia.medicion.respaldos_ia > 0 && <> Con {ia.medicion.respaldos_ia} respaldos por balanceo.</>}
          </p>
        ) : (
          <p><Badge tono="gris">IA</Badge> Para ver su columna, genera una previsualización con IA en <button className="text-brand-700 underline" onClick={irARepartir}>Repartir</button> (con &quot;Previsualizar&quot; o &quot;Repartir todo con IA&quot;) y vuelve aquí en la siguiente hora. Sin ejecutarla, no se guarda nada.</p>
        )}
      </Tarjeta>
    </div>
  );
}

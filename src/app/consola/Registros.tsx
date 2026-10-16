"use client";

import { useMemo, useState } from "react";
import { fmtMoneda, type Datos } from "@/lib/cliente";
import { Badge, Banderas, campo, Tarjeta } from "./ui";

const TONO_ESTADO = { nuevo: "azul", asignado: "violeta", en_gestion: "verde", descartado: "gris" } as const;

export function Registros({ datos, abrir }: { datos: Datos; abrir: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [zona, setZona] = useState("");
  const nombre = (id: number | null) => datos.usuarios.find((u) => u.id === id)?.nombre ?? "sin dato";

  const filas = useMemo(() => datos.registros.filter((r) =>
    (!estado || r.estado === estado) && (!zona || r.zona === zona) &&
    (!q || `${r.razon_social} ${r.nit} ${r.ciudad}`.toLowerCase().includes(q.toLowerCase()))), [datos, q, estado, zona]);

  return (
    <Tarjeta>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={`${campo} w-64`} placeholder="Buscar por empresa, NIT o ciudad…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={campo} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>{["nuevo", "asignado", "en_gestion", "descartado"].map((e) => <option key={e}>{e}</option>)}
        </select>
        <select className={campo} value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="">Todas las zonas</option>{["Centro", "Costa", "Occidente", "Antioquia"].map((z) => <option key={z}>{z}</option>)}
        </select>
        <span className="self-center text-sm text-slate-500">{filas.length} registros</span>
      </div>
      <div className="max-h-[40rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white text-xs uppercase text-slate-400"><tr><th className="py-1">Empresa</th><th>Zona</th><th>Segmento</th><th>Empl.</th><th>Ingresos</th><th>Estado</th><th>Con</th><th>Alertas</th></tr></thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => abrir(r.id)}>
                <td className="py-1.5 pr-2">{r.razon_social}</td><td>{r.zona ?? "sin dato"}</td><td>{r.segmento}</td><td>{r.empleados ?? "sin dato"}</td><td>{fmtMoneda(r.ingresos_estimados)}</td>
                <td><Badge tono={TONO_ESTADO[r.estado as keyof typeof TONO_ESTADO]}>{r.estado}</Badge></td>
                <td>{r.estado === "nuevo" || r.estado === "descartado" ? "sin dueño" : nombre(r.dueno_id)}</td>
                <td><Banderas lista={r.banderas.filter((b) => ["posible_duplicado", "pidio_no_insistir", "base_sin_validar"].includes(b))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

"use client";

import type { Datos } from "@/lib/cliente";
import { Badge, Banderas, Barra, Tarjeta } from "./ui";

export function Equipo({ datos }: { datos: Datos }) {
  const orden = [...datos.usuarios].sort((a, b) => (a.zona ?? "").localeCompare(b.zona ?? "") || a.id - b.id);
  return (
    <Tarjeta>
      <p className="mb-3 text-sm text-slate-500">Carga = registros en gestión cuyo último movimiento es del vendedor (o su asignación vigente). Fecha de referencia: <b>{datos.fecha}</b>.</p>
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-400"><tr><th className="py-1">Usuario</th><th>Rol</th><th>Zona</th><th>Segmento</th><th>Carga</th><th>Ingreso</th><th>Estado</th></tr></thead>
          <tbody>
            {orden.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 align-top">
                <td className="py-2 pr-3"><div className="font-medium">{u.nombre}</div><div className="mt-1"><Banderas lista={u.banderas.filter((b) => b !== "zona_normalizada")} /></div></td>
                <td>{u.rol}</td><td>{u.zona ?? "sin dato"}</td><td>{u.segmento_experto ?? "sin dato"}</td>
                <td>{u.rol === "admin" ? "no aplica" : <Barra valor={u.carga} max={u.capacidad_maxima} />}</td>
                <td>{u.fecha_ingreso ?? "sin dato"}</td>
                <td className="space-x-1">
                  {!u.activo && <Badge tono="rojo">inactivo</Badge>}
                  {u.ausencia && <Badge tono="ambar" titulo={`${u.ausencia.desde} → ${u.ausencia.hasta ?? "sin fecha de fin"}`}>{u.ausencia.motivo}</Badge>}
                  {u.activo && !u.ausencia && <Badge tono="verde">disponible</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

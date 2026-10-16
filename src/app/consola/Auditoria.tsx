"use client";

import { Fragment, useEffect, useState } from "react";
import { api, fmtFecha, type Ejecucion } from "@/lib/cliente";
import { Badge, Tarjeta } from "./ui";

interface FilaEjecucion { id: string; registro_id: number; vigente: boolean; motivo: string | null; registros: { razon_social: string; zona: string | null }; usuarios: { nombre: string } }

export function Auditoria({ version }: { version: number }) {
  const [lista, setLista] = useState<Ejecucion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Record<string, FilaEjecucion[]>>({});
  const abrir = (id: string) => {
    setAbierta(abierta === id ? null : id);
    if (!detalle[id]) api<FilaEjecucion[]>(`/api/ejecuciones/${id}`).then((d) => setDetalle((x) => ({ ...x, [id]: d }))).catch((e) => setError(e.message));
  };

  useEffect(() => {
    api<Ejecucion[]>("/api/ejecuciones").then(setLista).catch((e) => setError(e.message));
  }, [version]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!lista) return <p className="text-slate-500">Cargando…</p>;
  if (!lista.length) return <Tarjeta><p className="text-sm text-slate-500">Todavía no se ha ejecutado ninguna asignación.</p></Tarjeta>;

  return (
    <Tarjeta>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-400"><tr><th className="py-1">Cuándo</th><th>Tipo</th><th>Método</th><th>Registros</th><th>Ejecutó</th><th>Fecha ref.</th></tr></thead>
        <tbody>
          {lista.map((e) => (
            <Fragment key={e.id}>
              <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => abrir(e.id)}>
                <td className="py-1.5">{abierta === e.id ? "▾" : "▸"} {fmtFecha(e.creada_en)}</td>
                <td><Badge tono={e.tipo === "reasignacion" ? "ambar" : "azul"}>{e.tipo}</Badge></td><td>{e.metodo}</td><td>{e.total_registros}</td><td>{e.ejecutado_por}</td><td>{e.fecha_referencia}</td>
              </tr>
              {abierta === e.id && (
                <tr className="bg-slate-50"><td colSpan={6} className="px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-slate-500">Qué asignó</p>
                  {!detalle[e.id] ? <p className="text-xs text-slate-500">Cargando…</p> : (
                    <table className="mb-3 w-full text-xs"><thead className="text-left text-slate-400"><tr><th>Empresa</th><th>Zona</th><th>Asignada a</th><th>Estado</th><th>Motivo</th></tr></thead>
                      <tbody>{detalle[e.id].map((f) => (
                        <tr key={f.id} className="border-t border-slate-200 align-top">
                          <td className="py-1 font-medium">{f.registros.razon_social}</td><td>{f.registros.zona ?? "sin dato"}</td><td>{f.usuarios.nombre}</td>
                          <td>{f.vigente ? <Badge tono="verde">vigente</Badge> : <Badge>reemplazada</Badge>}</td><td className="max-w-md text-slate-600">{f.motivo}</td>
                        </tr>))}</tbody></table>
                  )}
                  <p className="mb-1 text-xs font-semibold text-slate-500">Parámetros exactos con los que se ejecutó</p>
                  <pre className="overflow-auto rounded bg-white p-3 text-xs">{JSON.stringify(e.parametros, null, 2)}</pre>
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api, fmtFecha, fmtMoneda, type AsignacionTraza, type Datos, type Traza } from "@/lib/cliente";
import { Badge, Banderas, boton, campo } from "./ui";

export function Detalle({ id, datos, actor, fecha, version, cerrar, alCambiar }: {
  id: number; datos: Datos; actor: number | null; fecha: string; version: number;
  cerrar: () => void; alCambiar: (m: string) => Promise<void>;
}) {
  const [traza, setTraza] = useState<Traza | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destino, setDestino] = useState<number | "">("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  useEffect(() => {
    api<Traza>(`/api/registros/${id}`).then(setTraza).catch((e) => setError(e.message));
  }, [id, version]);

  const usuario = (uid: number | null) => datos.usuarios.find((u) => u.id === uid);
  const reg = datos.registros.find((r) => r.id === id);
  if (!reg) return null;

  const vigente = traza?.asignaciones.find((a) => a.vigente);
  const ultAct = traza?.actividad.at(-1);
  const dueno = usuario(reg.dueno_id);

  const reasignar = async () => {
    if (!actor || destino === "") return;
    setEnviando(true); setErrorForm(null);
    try {
      await api("/api/reasignar", { registro_id: id, usuario_id: destino, motivo, ejecutado_por: actor, fechaReferencia: fecha });
      setMotivo(""); setDestino("");
      await alCambiar(`Registro reasignado a ${usuario(Number(destino))?.nombre}.`);
    } catch (e) { setErrorForm((e as Error).message); }
    setEnviando(false);
  };

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-slate-900/40" onClick={cerrar}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Detalle del registro">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{reg.razon_social}</h2>
            <p className="text-sm text-slate-500">NIT {reg.nit} · {reg.ciudad} · zona {reg.zona ?? "sin dato"} · registro #{reg.id}</p>
          </div>
          <button className={boton()} onClick={cerrar}>Cerrar</button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded bg-slate-50 p-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-400">Estado</dt><dd>{reg.estado}</dd></div>
          <div><dt className="text-xs text-slate-400">Segmento</dt><dd>{reg.segmento}</dd></div>
          <div><dt className="text-xs text-slate-400">Sector</dt><dd>{reg.sector ?? "sin dato"}</dd></div>
          <div><dt className="text-xs text-slate-400">Empleados</dt><dd>{reg.empleados ?? "sin dato"}</dd></div>
          <div><dt className="text-xs text-slate-400">Ingresos</dt><dd>{fmtMoneda(reg.ingresos_estimados)}</dd></div>
          <div><dt className="text-xs text-slate-400">Fuente · creado</dt><dd>{reg.fuente} · {reg.fecha_creacion}</dd></div>
        </dl>
        {reg.notas && <p className="mt-2 text-sm italic text-slate-600">“{reg.notas}”</p>}
        <div className="mt-2"><Banderas lista={reg.banderas} /></div>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">¿Por qué este registro terminó acá?</h3>
        {error && <p className="text-red-700">{error}</p>}
        {!traza && !error && <p className="text-sm text-slate-500">Cargando…</p>}
        {traza && (
          <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
            {vigente ? (
              <>
                <p><b>{vigente.usuarios.nombre}</b> lo tiene por una {vigente.ejecuciones.tipo === "reasignacion" ? "reasignación" : "asignación"} del {fmtFecha(vigente.creada_en)}, ejecutada por <b>{vigente.ejecutado_por}</b> con el método <b>{vigente.metodo}</b>.</p>
                <p className="mt-2">{vigente.motivo}</p>
                {vigente.reemplaza_a && <p className="mt-2 text-slate-600">Reemplazó a la asignación anterior de {traza.asignaciones.find((a) => a.id === vigente.reemplaza_a)?.usuarios.nombre}.</p>}
              </>
            ) : reg.estado === "nuevo" ? (
              <p>Sigue <b>pendiente</b>: nadie lo ha tomado ni el motor lo ha asignado todavía.</p>
            ) : reg.estado === "descartado" ? (
              <p>Fue <b>descartado</b>{ultAct ? <> (último movimiento de {usuario(ultAct.usuario_id)?.nombre} el {ultAct.fecha})</> : null}.</p>
            ) : (
              <p>No pasó por el motor: viene de la <b>operación anterior</b>. Su dueño es <b>{dueno?.nombre ?? "desconocido"}</b>, porque fue quien hizo la última acción
                {ultAct ? <> ({ultAct.tipo}, {ultAct.fecha})</> : null}.
                {dueno && !dueno.activo ? <span className="font-medium text-red-700"> Ese vendedor está inactivo: conviene reasignarlo.</span> : null}</p>
            )}
          </div>
        )}

        {traza && traza.asignaciones.length > 0 && (
          <>
            <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Historial de asignaciones</h3>
            <ol className="space-y-3">{[...traza.asignaciones].reverse().map((a) => <Asignacion key={a.id} a={a} />)}</ol>
          </>
        )}

        {traza && traza.actividad.length > 0 && (
          <>
            <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Actividad previa ({traza.actividad.length})</h3>
            <ul className="max-h-48 overflow-auto text-sm text-slate-700">
              {[...traza.actividad].reverse().map((x) => <li key={x.id} className="border-t border-slate-100 py-1">{x.fecha} · {x.tipo} · {usuario(x.usuario_id)?.nombre}</li>)}
            </ul>
          </>
        )}

        {reg.estado !== "descartado" && (
          <div className="mt-6 rounded border border-slate-200 p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Reasignar manualmente</h3>
            <select className={`${campo} w-full`} value={destino} onChange={(e) => setDestino(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Elegir vendedor…</option>
              {datos.usuarios.filter((u) => u.rol === "vendedor" && u.id !== reg.dueno_id).map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}: {u.carga}/{u.capacidad_maxima ?? "?"}{u.activo ? "" : " (inactivo)"}{u.ausencia ? ` (${u.ausencia.motivo})` : ""}</option>
              ))}
            </select>
            <textarea className={`${campo} mt-2 w-full`} rows={2} placeholder="Motivo (obligatorio, queda en la traza)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            {errorForm && <p role="alert" className="mt-2 text-sm text-red-700">{errorForm}</p>}
            <button className={`${boton("primario")} mt-2`} disabled={enviando || destino === "" || motivo.trim().length < 5 || !actor} onClick={reasignar}>Reasignar</button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Asignacion({ a }: { a: AsignacionTraza }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <li className="rounded border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span><b>{a.usuarios.nombre}</b> · {a.metodo} · {fmtFecha(a.creada_en)}</span>
        {a.vigente ? <Badge tono="verde">vigente</Badge> : <Badge>reemplazada</Badge>}
      </div>
      <p className="mt-1 text-xs text-slate-500">Ejecutó {a.ejecutado_por}</p>
      <p className="mt-1 text-slate-700">{a.motivo}</p>
      <button className="mt-2 text-xs text-blue-700 hover:underline" onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar" : "Ver"} candidatos y parámetros</button>
      {abierto && (
        <div className="mt-2 space-y-2">
          <table className="w-full text-xs"><thead className="text-left text-slate-400"><tr><th>Candidato</th><th>Carga</th><th>Puntaje</th><th>Detalle</th></tr></thead>
            <tbody>{(a.candidatos ?? []).map((c) => (
              <tr key={c.usuario_id} className={`border-t border-slate-100 ${c.usuario_id === a.usuarios.id ? "bg-emerald-50 font-medium" : ""}`}>
                <td className="py-1">{c.nombre}</td><td>{c.carga}/{c.capacidad ?? "sin dato"}</td><td>{c.puntaje ?? "sin dato"}</td>
                <td>{c.elegible ? (c.desglose ? Object.entries(c.desglose).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(" · ") : "elegible") : <span className="text-red-700">descartado: {c.descartes.join(", ")}</span>}</td></tr>))}</tbody></table>
          <pre className="overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(a.parametros, null, 2)}</pre>
          {a.prompt_enviado && (
            <div><p className="text-xs font-semibold text-slate-500">Prompt enviado al modelo ({a.modelo})</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{a.prompt_enviado}</pre>
              <p className="mt-2 text-xs font-semibold text-slate-500">Respuesta del modelo</p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{a.respuesta_modelo}</pre></div>
          )}
        </div>
      )}
    </li>
  );
}

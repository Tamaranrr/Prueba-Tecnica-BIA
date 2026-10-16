"use client";

import { Fragment, useState } from "react";
import { api, METODOS, type Datos, type Preview } from "@/lib/cliente";
import { PARAMETROS_DEFECTO, PERFILES_PESOS, PESOS_DEFECTO } from "@/lib/engine/tipos";
import { TablaRegistros } from "./TablaRegistros";
import { Banderas, Badge, Barra, boton, campo, Tarjeta, Titulo } from "./ui";

type Alcance = "pendientes" | "seleccion" | "usuario";
const RETENER = [
  { id: "duplicado", nombre: "Posibles duplicados" },
  { id: "pidio_no_insistir", nombre: "Pidieron no insistir" },
  { id: "base_sin_validar", nombre: "Base comprada sin validar" },
];
const PESOS = [
  { id: "segmento", nombre: "Segmento experto" }, { id: "zona", nombre: "Misma zona" },
  { id: "carga", nombre: "Carga baja" }, { id: "antiguedad", nombre: "Antigüedad" },
] as const;

export function Reparto({ datos, actor, fecha, abrir, alEjecutar, seleccion, setSeleccion }: {
  datos: Datos; actor: number | null; fecha: string; abrir: (id: number) => void; alEjecutar: (m: string) => Promise<void>;
  seleccion: Set<number>; setSeleccion: (s: Set<number>) => void;
}) {
  const [metodo, setMetodo] = useState<string>("balanceo_carga");
  const [alcance, setAlcance] = useState<Alcance>("pendientes");
  const [origen, setOrigen] = useState<number | "">("");
  const [zona, setZona] = useState<"estricta" | "preferente" | "ignorar">(PARAMETROS_DEFECTO.zona);
  const [desbordar, setDesbordar] = useState(PARAMETROS_DEFECTO.desbordarSiNoHay);
  const [lideres, setLideres] = useState(false);
  const [retener, setRetener] = useState<string[]>(PARAMETROS_DEFECTO.retener);
  const [pesos, setPesos] = useState({ ...PESOS_DEFECTO });
  const [grandesExpertos, setGrandesExpertos] = useState(PARAMETROS_DEFECTO.grandesSoloExpertos);
  // Balancear funciona con zona estricta; reglas e IA pesan el encaje de segmento y tratan la zona como preferencia.
  const elegirMetodo = (id: string) => { setMetodo(id); setZona(id === "reglas" || id === "ia" ? "preferente" : "estricta"); };
  const perfilActual = PERFILES_PESOS.find((p) => (Object.keys(p.pesos) as (keyof typeof pesos)[]).every((k) => p.pesos[k] === pesos[k]))?.id ?? "personalizado";
  const [limiteIA, setLimiteIA] = useState(10);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [prevSol, setPrevSol] = useState<string | null>(null); // configuración exacta con la que se previsualizó
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());

  const nombre = (id: number | null) => datos.usuarios.find((u) => u.id === id)?.nombre ?? "sin dato";
  const regs = new Map(datos.registros.map((r) => [r.id, r]));
  const pendientes = datos.registros.filter((r) => r.estado === "nuevo");
  const vendedoresConCarga = datos.usuarios.filter((u) => u.rol === "vendedor" && u.carga > 0);

  const solicitud = () => ({
    metodo, fechaReferencia: fecha, ia: { limite: limiteIA },
    alcance: alcance === "pendientes" ? { tipo: "pendientes" }
      : alcance === "seleccion" ? { tipo: "registros", ids: [...seleccion].sort((a, b) => a - b) }
      : { tipo: "usuario", usuario_id: origen },
    parametros: { zona, desbordarSiNoHay: desbordar, incluirLideres: lideres, retener, pesos, grandesSoloExpertos: grandesExpertos },
  });
  const listoParaCorrer = alcance === "pendientes" || (alcance === "seleccion" && seleccion.size > 0) || (alcance === "usuario" && origen !== "");
  // Si cambia cualquier ajuste después de previsualizar, lo que se vería ya no es lo que se ejecutaría.
  const desactualizada = prev !== null && prevSol !== JSON.stringify(solicitud());

  const previsualizar = async () => {
    setCargando(true); setError(null); setAbiertos(new Set());
    try {
      const sol = solicitud();
      const p = await api<Preview>("/api/preview", sol);
      setPrev(p); setPrevSol(JSON.stringify(sol));
    } catch (e) { setError((e as Error).message); setPrev(null); }
    setCargando(false);
  };
  const ejecutar = async () => {
    if (!prev || !actor || !prevSol || desactualizada) return;
    if (!confirm(`Se asignarán ${prev.resumen.asignables} registros con el método "${prev.metodo}". ¿Confirmar?`)) return;
    setCargando(true); setError(null);
    try {
      const r = await api<{ asignados: number }>("/api/ejecutar", { ...JSON.parse(prevSol), ejecutado_por: actor, preview_id: prev.preview_id });
      setPrev(null);
      await alEjecutar(`Listo: ${r.asignados} registros asignados. Quedó guardado en Auditoría.`);
    } catch (e) { setError((e as Error).message); }
    setCargando(false);
  };
  const alternar = (id: number) => setAbiertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const cambioPorUsuario = prev ? datos.usuarios.filter((u) => u.rol !== "admin" && (prev.cargaFinal[u.id] ?? 0) !== (prev.cargaInicial[u.id] ?? 0)) : [];

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <div className="min-w-0 space-y-4">
        <Tarjeta>
          <Titulo>1 · Qué repartir</Titulo>
          <label className="mb-2 flex items-start gap-2 text-sm"><input type="radio" checked={alcance === "pendientes"} onChange={() => setAlcance("pendientes")} className="mt-1" />
            <span>Todos los pendientes <Badge tono="azul">{pendientes.length}</Badge></span></label>
          <label className={`mb-2 flex items-start gap-2 text-sm ${seleccion.size ? "" : "text-slate-400"}`}><input type="radio" disabled={seleccion.size === 0} checked={alcance === "seleccion"} onChange={() => setAlcance("seleccion")} className="mt-1" />
            <span>Solo los registros seleccionados <Badge tono={seleccion.size ? "azul" : "gris"}>{seleccion.size}</Badge>{seleccion.size === 0 && <span className="block text-xs">Márcalos en la tabla de la derecha o en Registros.</span>}</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="radio" checked={alcance === "usuario"} onChange={() => setAlcance("usuario")} className="mt-1" />
            <span>Reasignar todo lo de un vendedor</span></label>
          {alcance === "usuario" && (
            <select className={`${campo} mt-2 w-full`} value={origen} onChange={(e) => setOrigen(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Elegir vendedor…</option>
              {vendedoresConCarga.map((u) => <option key={u.id} value={u.id}>{u.nombre}: {u.carga} registro{u.carga === 1 ? "" : "s"}{!u.activo ? " (inactivo)" : u.ausencia ? ` (ausente: ${u.ausencia.motivo.toLowerCase()})` : ""}</option>)}
            </select>
          )}
        </Tarjeta>

        <Tarjeta>
          <Titulo>2 · Método</Titulo>
          <div className="space-y-2">
            {METODOS.map((m) => (
              <label key={m.id} className={`block cursor-pointer rounded border p-2.5 text-sm ${metodo === m.id ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" className="mr-2" checked={metodo === m.id} onChange={() => elegirMetodo(m.id)} /><b>{m.nombre}</b>
                <p className="mt-1 text-xs text-slate-600">{m.desc}</p>
              </label>
            ))}
            {metodo === "ia" && (
              <label className="flex items-center justify-between gap-2 rounded bg-slate-50 p-2.5 text-xs text-slate-600" title="Cada registro es una consulta al modelo; se hacen una tras otra porque cada decisión cambia la carga de la siguiente.">
                Máx. registros por corrida
                <input type="number" min={1} max={40} className={`${campo} w-20`} value={limiteIA} onChange={(e) => setLimiteIA(Number(e.target.value))} />
              </label>
            )}
          </div>
        </Tarjeta>

        <Tarjeta>
          <Titulo>3 · Parámetros</Titulo>
          <label className="mb-2 block text-sm text-slate-700">Zona
            <select className={`${campo} mt-1 w-full`} value={zona} onChange={(e) => setZona(e.target.value as typeof zona)}>
              <option value="estricta">Estricta: solo vendedores de la zona</option>
              <option value="preferente">Preferente: la zona suma puntos</option>
              <option value="ignorar">Ignorar la zona</option>
            </select>
          </label>
          {zona === "estricta" && <label className="mb-2 flex gap-2 text-sm"><input type="checkbox" checked={desbordar} onChange={(e) => setDesbordar(e.target.checked)} />Desbordar a otras zonas si no hay nadie</label>}
          <label className="mb-3 flex gap-2 text-sm"><input type="checkbox" checked={lideres} onChange={(e) => setLideres(e.target.checked)} />Incluir líderes como receptores</label>
          <p className="mb-1 text-sm text-slate-700">Retener para revisión (no asignar):</p>
          {RETENER.map((r) => (
            <label key={r.id} className="flex gap-2 text-sm"><input type="checkbox" checked={retener.includes(r.id)}
              onChange={(e) => setRetener((x) => e.target.checked ? [...x, r.id] : x.filter((y) => y !== r.id))} />{r.nombre}</label>
          ))}
          {metodo === "reglas" && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="mb-1 text-sm text-slate-700">Perfil de pesos</p>
              <select aria-label="Perfil de pesos" className={`${campo} mb-1 w-full`} value={perfilActual} onChange={(e) => { const p = PERFILES_PESOS.find((x) => x.id === e.target.value); if (p) setPesos({ ...p.pesos }); }}>
                {PERFILES_PESOS.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                {perfilActual === "personalizado" && <option value="personalizado">Personalizado</option>}
              </select>
              <p className="mb-2 text-xs text-slate-500">{PERFILES_PESOS.find((p) => p.id === perfilActual)?.desc ?? "Pesos ajustados a mano."}</p>
              <label className="mb-2 flex gap-2 text-sm text-slate-700" title="Las cuentas corporativas solo compiten entre expertos corporativos con la antigüedad mínima.">
                <input type="checkbox" checked={grandesExpertos} onChange={(e) => setGrandesExpertos(e.target.checked)} />Cuentas grandes solo a expertos corporativos</label>
              {PESOS.map((p) => (
                <label key={p.id} className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-600">{p.nombre}
                  <input type="number" min={0} max={100} className={`${campo} w-20`} value={pesos[p.id]} onChange={(e) => setPesos({ ...pesos, [p.id]: Number(e.target.value) })} /></label>
              ))}
              <label className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-600" title="Una cuenta corporativa no se asigna a quien lleve menos días">Días mín. para cuentas grandes
                <input type="number" min={0} className={`${campo} w-20`} value={pesos.diasMinCorporativo} onChange={(e) => setPesos({ ...pesos, diasMinCorporativo: Number(e.target.value) })} /></label>
            </div>
          )}
        </Tarjeta>

        <button className={`${boton("primario")} w-full`} disabled={cargando || !listoParaCorrer} onClick={previsualizar}>
          {cargando ? (metodo === "ia" ? "Consultando a Claude… puede tardar" : "Calculando…") : "Previsualizar reparto"}
        </button>
      </div>

      <div className="min-w-0 space-y-4">
        {error && <p role="alert" className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

        {!prev && (
          <Tarjeta>
            <p className="mb-3 text-sm text-slate-600">Configura el reparto y pulsa <b>Previsualizar</b>. No se guarda nada hasta que lo ejecutes. Puedes filtrar la tabla y marcar solo los registros que quieras repartir.</p>
            {seleccion.size > 0 && alcance !== "seleccion" && (
              <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                Tienes {seleccion.size} registros seleccionados.
                <button className={boton("primario")} onClick={() => setAlcance("seleccion")}>Repartir solo estos</button>
              </p>
            )}
            <TablaRegistros datos={datos} base={pendientes} seleccion={seleccion} setSeleccion={setSeleccion} abrir={abrir} estadoFijo alto="30rem" />
          </Tarjeta>
        )}

        {prev && (
          <>
            <Tarjeta>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Titulo>Previsualización (no guardada)</Titulo>
                  <p className="text-sm text-slate-700">
                    <b className="text-emerald-700">{prev.resumen.asignables}</b> se asignarían · <b className="text-amber-700">{prev.resumen.retenidos}</b> retenidos · <b className="text-red-700">{prev.resumen.sin_candidato}</b> sin candidato
                    {prev.sin_procesar ? <> · <b>{prev.sin_procesar}</b> quedan para la siguiente corrida</> : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className={boton()} onClick={() => { setPrev(null); setPrevSol(null); }}>Descartar</button>
                  <button className={boton("peligro")} disabled={cargando || !prev.resumen.asignables || !actor || desactualizada} onClick={ejecutar}>Ejecutar reparto</button>
                </div>
              </div>
              {desactualizada && (
                <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Cambiaste la configuración después de previsualizar. Lo que ves ya no es lo que se ejecutaría: pulsa <b>Previsualizar reparto</b> otra vez.
                </p>
              )}
              <h3 className="mt-4 mb-2 text-sm font-semibold text-slate-600">Carga por vendedor (actual + lo nuevo)</h3>
              <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {cambioPorUsuario.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{u.nombre}</span>
                    <Barra valor={prev.cargaInicial[u.id] ?? 0} extra={(prev.cargaFinal[u.id] ?? 0) - (prev.cargaInicial[u.id] ?? 0)} max={u.capacidad_maxima} /></div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta>
              <Titulo>Propuesta registro por registro</Titulo>
              <div className="max-h-[36rem] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs uppercase text-slate-400"><tr><th className="py-1">Empresa</th><th>Zona</th><th>Segmento</th>{alcance !== "pendientes" && <th>Hoy con</th>}<th>Asignar a</th><th></th></tr></thead>
                  <tbody>
                    {prev.propuestas.map((p) => {
                      const r = regs.get(p.registro_id)!;
                      const abierto = abiertos.has(p.registro_id);
                      return (
                        <Fragment key={p.registro_id}>
                          <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => alternar(p.registro_id)}>
                            <td className="py-1.5 pr-2">{abierto ? "▾" : "▸"} {r.razon_social}</td><td>{r.zona ?? "sin dato"}</td><td>{p.segmento}</td>
                            {alcance !== "pendientes" && <td>{p.dueno_actual ? nombre(p.dueno_actual) : "sin dueño"}</td>}
                            <td className={p.usuario_id ? "font-medium text-slate-900" : "text-red-700"}>{p.usuario_id ? nombre(p.usuario_id) : "Sin candidato"}</td>
                            <td className="text-right"><Banderas lista={p.banderas_decision} /></td>
                          </tr>
                          {abierto && (
                            <tr className="bg-slate-50"><td colSpan={6} className="px-4 py-3">
                              <p className="mb-2 text-sm text-slate-700">{p.motivo}</p>
                              {p.prompt_enviado && (
                                <details className="mb-2 text-xs"><summary className="cursor-pointer text-indigo-700">Ver prompt completo enviado al modelo{p.modelo ? ` (${p.modelo})` : ""} y su respuesta</summary>
                                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-2">{p.prompt_enviado}</pre>
                                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-white p-2">{p.respuesta_modelo ?? "(sin respuesta)"}</pre></details>
                              )}
                              <table className="w-full text-xs"><thead className="text-slate-400"><tr><th className="text-left">Candidato</th><th className="text-left">Carga</th><th className="text-left">Puntaje</th><th className="text-left">Detalle</th></tr></thead>
                                <tbody>{p.candidatos.map((c) => (
                                  <tr key={c.usuario_id} className={`border-t border-slate-200 ${c.usuario_id === p.usuario_id ? "bg-emerald-50 font-medium" : ""}`}>
                                    <td className="py-1">{c.nombre}</td><td>{c.carga}/{c.capacidad ?? "sin dato"}</td><td>{c.puntaje ?? "sin dato"}</td>
                                    <td>{c.elegible ? (c.desglose ? Object.entries(c.desglose).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(" · ") : "elegible") : <span className="text-red-700">descartado: {c.descartes.join(", ")}</span>}</td></tr>))}</tbody></table>
                            </td></tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {prev.retenidos.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <h3 className="mb-2 text-sm font-semibold text-amber-700">Retenidos para revisión humana ({prev.retenidos.length})</h3>
                  {prev.retenidos.map((x) => (
                    <p key={x.registro_id} className="cursor-pointer text-sm text-slate-700 hover:underline" onClick={() => abrir(x.registro_id)}>
                      {regs.get(x.registro_id)?.razon_social} <Banderas lista={x.razones} /></p>
                  ))}
                </div>
              )}
            </Tarjeta>
          </>
        )}
      </div>
    </div>
  );
}

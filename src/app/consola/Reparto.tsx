"use client";

import { useState } from "react";
import { api, METODOS, type Datos, type Preview } from "@/lib/cliente";
import { explicarAsignacion } from "@/lib/engine/explicar";
import { PARAMETROS_DEFECTO, PERFILES_PESOS, PESOS_DEFECTO } from "@/lib/engine/tipos";
import { TablaRegistros } from "./TablaRegistros";
import { TablaCandidatos } from "./Candidatos";
import { IconoFlecha } from "./iconos";
import { Avatar, Badge, Banderas, BarraOcupacion, LecturaNota, boton, campo, Tarjeta, Titulo } from "./ui";

const ResumenCifra = ({ valor, etiqueta, tono }: { valor: number; etiqueta: string; tono: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className={`text-3xl font-bold tabular-nums ${tono}`}>{valor}</p><p className="mt-1 text-xs text-slate-500">{etiqueta}</p></div>
);
/** Las razones de retención llegan como códigos (duplicado_de_21); aquí se dicen como las diría una persona. */
function razonLegible(z: string): string {
  let m: RegExpMatchArray | null;
  if ((m = z.match(/^duplicado_de_(\d+)$/))) return `duplicado de la empresa #${m[1]}`;
  if ((m = z.match(/^duplicado_en_(\w+?)_(\d+)$/))) return `parece duplicado de una empresa ${m[1].replaceAll("_", " ")} (#${m[2]})`;
  if (z === "pidio_no_insistir" || z === "nota_no_contactar") return "pidió que no insistan";
  return z.replaceAll("_", " ");
}

type Alcance = "pendientes" | "seleccion" | "usuario" | "frias";
const RETENER = [
  { id: "duplicado", nombre: "Posibles duplicados" },
  { id: "pidio_no_insistir", nombre: "Pidieron no insistir" },
  { id: "base_sin_validar", nombre: "Base comprada sin validar" },
];
const OLA_TEXTO = 6;   // igual a OLA_DEFECTO de src/lib/ia.ts (no se importa para no arrastrar el SDK al navegador)
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
  const [usarNotas, setUsarNotas] = useState(PARAMETROS_DEFECTO.usarNotasIA);
  const [grandesExpertos, setGrandesExpertos] = useState(PARAMETROS_DEFECTO.grandesSoloExpertos);
  // Balancear funciona con zona estricta; reglas e IA pesan el encaje de segmento y tratan la zona como preferencia.
  const elegirMetodo = (id: string) => { setMetodo(id); setZona(id === "reglas" || id === "ia" ? "preferente" : "estricta"); };
  const perfilActual = PERFILES_PESOS.find((p) => (Object.keys(p.pesos) as (keyof typeof pesos)[]).every((k) => p.pesos[k] === pesos[k]))?.id ?? "personalizado";
  const [limiteIA, setLimiteIA] = useState(10);
  const [ventanaAusencia, setVentanaAusencia] = useState(PARAMETROS_DEFECTO.ventanaAusenciaDias);
  const [capacidadRampa, setCapacidadRampa] = useState(PARAMETROS_DEFECTO.capacidadRampa);
  const [rampaPyme, setRampaPyme] = useState(PARAMETROS_DEFECTO.rampaSoloPyme);
  const [diasFrias, setDiasFrias] = useState(30);
  const [soloPleno, setSoloPleno] = useState(PARAMETROS_DEFECTO.soloPlenoParaGrandes);
  const [todo, setTodo] = useState(false);                                         // la previsualización actual es de "Repartir todo"
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [prevSol, setPrevSol] = useState<string | null>(null); // configuración exacta con la que se previsualizó
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());

  const nombre = (id: number | null) => datos.usuarios.find((u) => u.id === id)?.nombre ?? "sin dato";
  const regs = new Map(datos.registros.map((r) => [r.id, r]));
  const pendientes = datos.registros.filter((r) => r.estado === "nuevo");
  const vendedoresConCarga = datos.usuarios.filter((u) => u.rol === "vendedor" && u.carga > 0);
  const frias = datos.usuarios.reduce((s, u) => s + u.perfil.frias, 0);

  const solicitud = (modoTodo: boolean = todo) => ({
    metodo, fechaReferencia: fecha, ia: { limite: limiteIA, todo: modoTodo },
    alcance: alcance === "pendientes" ? { tipo: "pendientes" }
      : alcance === "seleccion" ? { tipo: "registros", ids: [...seleccion].sort((a, b) => a - b) }
      : alcance === "frias" ? { tipo: "frias", dias: diasFrias }
      : { tipo: "usuario", usuario_id: origen },
    parametros: {
      zona, desbordarSiNoHay: desbordar, incluirLideres: lideres, retener, pesos, grandesSoloExpertos: grandesExpertos, usarNotasIA: usarNotas,
      ventanaAusenciaDias: ventanaAusencia, capacidadRampa, rampaSoloPyme: rampaPyme, soloPlenoParaGrandes: soloPleno,
    },
  });
  const listoParaCorrer = alcance === "pendientes" || (alcance === "seleccion" && seleccion.size > 0) || (alcance === "usuario" && origen !== "") || alcance === "frias";
  // Si cambia cualquier ajuste después de previsualizar, lo que se vería ya no es lo que se ejecutaría.
  const desactualizada = prev !== null && prevSol !== JSON.stringify(solicitud());

  const previsualizar = async () => {
    setCargando(true); setError(null); setAbiertos(new Set()); setTodo(false);
    try {
      const sol = solicitud(false);
      const p = await api<Preview>("/api/preview", sol);
      setPrev(p); setPrevSol(JSON.stringify(sol));
    } catch (e) { setError((e as Error).message); setPrev(null); }
    setCargando(false);
  };
  /** "Repartir todo con IA": todos los asignables, sin tope, en olas paralelas y con el avance en vivo. */
  const repartirTodo = async () => {
    setCargando(true); setError(null); setAbiertos(new Set()); setPrev(null); setPrevSol(null); setTodo(true); setProgreso({ hechos: 0, total: 0 });
    try {
      const sol = solicitud(true);
      const r = await fetch("/api/preview-todo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sol) });
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error ?? "Error inesperado"); }
      const lector = r.body.getReader(), dec = new TextDecoder();
      let buf = "", final: Preview | null = null;
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const linea = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!linea) continue;
          const ev = JSON.parse(linea);
          if (ev.tipo === "progreso") setProgreso({ hechos: ev.hechos, total: ev.total });
          else if (ev.tipo === "fin") final = ev.resultado as Preview;
          else if (ev.tipo === "error") throw new Error(ev.mensaje);
        }
      }
      if (!final) throw new Error("La respuesta se cortó antes de terminar. Vuelve a intentarlo.");
      setPrev(final); setPrevSol(JSON.stringify(sol));
    } catch (e) { setError((e as Error).message); setPrev(null); setPrevSol(null); }
    setProgreso(null); setCargando(false);
  };
  const ejecutar = async () => {
    if (!prev || !actor || !prevSol || desactualizada) return;
    if (!confirm(`Se asignarán ${prev.resumen.asignables} registros con el método "${prev.metodo}". ¿Confirmar?`)) return;
    setCargando(true); setError(null);
    try {
      const r = await api<{ asignados: number }>("/api/ejecutar", { ...JSON.parse(prevSol), preview_id: prev.preview_id });
      setPrev(null);
      await alEjecutar(`Listo: ${r.asignados} registros asignados. Quedó guardado en Auditoría.`);
    } catch (e) { setError((e as Error).message); }
    setCargando(false);
  };
  const alternar = (id: number) => setAbiertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const cambioPorUsuario = prev ? datos.usuarios.filter((u) => u.rol !== "admin" && (prev.cargaFinal[u.id] ?? 0) !== (prev.cargaInicial[u.id] ?? 0)) : [];

  return (
    <div className="space-y-5">
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-[1fr_1.4fr_1fr]">
        <Tarjeta>
          <Titulo>1 · Qué repartir</Titulo>
          <label className="mb-2 flex items-start gap-2 text-sm"><input type="radio" checked={alcance === "pendientes"} onChange={() => setAlcance("pendientes")} className="mt-1" />
            <span>Todos los pendientes <Badge tono="marca">{pendientes.length}</Badge></span></label>
          <label className={`mb-2 flex items-start gap-2 text-sm ${seleccion.size ? "" : "text-slate-400"}`}><input type="radio" disabled={seleccion.size === 0} checked={alcance === "seleccion"} onChange={() => setAlcance("seleccion")} className="mt-1" />
            <span>Solo los registros seleccionados <Badge tono={seleccion.size ? "marca" : "gris"}>{seleccion.size}</Badge>{seleccion.size === 0 && <span className="block text-xs">Márcalos en la tabla de la derecha o en Registros.</span>}</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="radio" checked={alcance === "usuario"} onChange={() => setAlcance("usuario")} className="mt-1" />
            <span>Reasignar todo lo de un vendedor</span></label>
          <label className={`mt-2 flex items-start gap-2 text-sm ${frias ? "" : "text-slate-400"}`}><input type="radio" disabled={!frias} checked={alcance === "frias"} onChange={() => setAlcance("frias")} className="mt-1" />
            <span>Cuentas frías: sin movimiento desde hace <input type="number" min={1} className={`${campo} mx-1 w-16`} value={diasFrias} onChange={(e) => setDiasFrias(Math.max(1, Number(e.target.value)))} disabled={alcance !== "frias"} /> días <Badge tono={frias ? "ambar" : "gris"}>{frias}</Badge>
              <span className="block text-xs text-slate-500">Cuentas que ya tienen dueño pero nadie ha movido. Cada una pasa a otro vendedor.</span></span></label>
          {alcance === "usuario" && (
            <select className={`${campo} mt-2 w-full`} value={origen} onChange={(e) => setOrigen(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Elegir vendedor…</option>
              {vendedoresConCarga.map((u) => <option key={u.id} value={u.id}>{u.nombre}: {u.carga} registro{u.carga === 1 ? "" : "s"}{!u.activo ? " (inactivo)" : u.ausencia ? ` (ausente: ${u.ausencia.motivo.toLowerCase()})` : ""}</option>)}
            </select>
          )}
        </Tarjeta>

        <Tarjeta>
          <Titulo>2 · Método</Titulo>
          <div className="grid gap-2 sm:grid-cols-2">
            {METODOS.map((m) => (
              <label key={m.id} className={`block cursor-pointer rounded-lg border p-3 text-sm ${metodo === m.id ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>
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
          <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500">3 · Parámetros <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">(zona, ausencias, notas, retenciones)</span></summary>
          <div className="mt-3">
          <label className="mb-2 block text-sm text-slate-700">Zona
            <select className={`${campo} mt-1 w-full`} value={zona} onChange={(e) => setZona(e.target.value as typeof zona)}>
              <option value="estricta">Estricta: solo vendedores de la zona</option>
              <option value="preferente">Preferente: la zona suma puntos</option>
              <option value="ignorar">Ignorar la zona</option>
            </select>
          </label>
          {zona === "estricta" && <label className="mb-2 flex gap-2 text-sm"><input type="checkbox" checked={desbordar} onChange={(e) => setDesbordar(e.target.checked)} />Desbordar a otras zonas si no hay nadie</label>}
          <label className="mb-2 flex gap-2 text-sm" title="Una IA lee cada nota en texto libre y la convierte en señales: urgencia, perfil senior, experto del sector, necesidad industrial. Cada texto se lee una sola vez y queda guardado."><input type="checkbox" checked={usarNotas} onChange={(e) => setUsarNotas(e.target.checked)} />Leer las notas con IA (urgencia, perfil, necesidad)</label>
          <div className="mb-3 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700">
            <label className="mb-2 flex items-center justify-between gap-2" title="No se dan cuentas nuevas a quien se ausenta dentro de estos días. 0 = solo se excluye a quien ya está ausente.">Ausencias próximas (días)
              <input type="number" min={0} max={60} className={`${campo} w-20`} value={ventanaAusencia} onChange={(e) => setVentanaAusencia(Math.max(0, Number(e.target.value)))} /></label>
            <label className="mb-2 flex items-center justify-between gap-2" title="Un recién entrado con capacidad 0 recibe esta capacidad provisional para poder nivelarse. 0 = queda excluido.">Capacidad de recién entrados
              <input type="number" min={0} max={40} className={`${campo} w-20`} value={capacidadRampa} onChange={(e) => setCapacidadRampa(Math.max(0, Number(e.target.value)))} /></label>
            <label className="flex gap-2" title="Quien lleva menos de 6 meses solo recibe cuentas pequeñas (pyme)."><input type="checkbox" checked={rampaPyme} onChange={(e) => setRampaPyme(e.target.checked)} />En rampa (menos de 6 meses): solo cuentas pyme</label>
            <label className="mt-2 flex gap-2" title="Una cuenta corporativa solo se asigna a quien lleva 2 años o más (nivel pleno o senior), con cualquier método."><input type="checkbox" checked={soloPleno} onChange={(e) => setSoloPleno(e.target.checked)} />Cuentas corporativas solo a pleno o senior (2 años o más)</label>
            <p className="mt-2 text-xs text-slate-500">Orden de reparto: corporativo, industrial, pyme. Corporativo se define por ingresos (18.000 M COP o más).</p>
          </div>
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
          </div>
          </details>
        </Tarjeta>

        <div className="flex flex-wrap items-stretch gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:col-span-2 2xl:col-span-3">
        <button className={`${boton("primario")} min-w-60`} disabled={cargando || !listoParaCorrer} onClick={previsualizar}>
          {cargando && !progreso ? (metodo === "ia" ? "Consultando a Claude… puede tardar" : "Calculando…") : "Previsualizar reparto"}
        </button>
        {metodo === "ia" && alcance === "pendientes" && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-slate-700">
            <button className={`${boton("secundario")} shrink-0`} disabled={cargando} onClick={repartirTodo}>Repartir todo con IA ({pendientes.length} pendientes)</button>
            <p className="min-w-48 flex-1 text-xs text-slate-600">Revisa y reparte todos los pendientes de una vez, por prioridad y sin tope de registros. Consulta al modelo de {OLA_TEXTO} en {OLA_TEXTO} y revalida cada decisión con las reglas duras. Dura cerca de un minuto y no guarda nada hasta que ejecutes.</p>
          </div>
        )}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        {progreso && (
          <Tarjeta>
            <Titulo>Repartiendo todo con IA</Titulo>
            <p className="mb-2 text-sm text-slate-700" aria-live="polite">
              {progreso.total === 0 ? "Revisando los pendientes y preparando las consultas…" : <><b>{progreso.hechos}</b> de <b>{progreso.total}</b> registros decididos</>}
            </p>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={progreso.total || 1} aria-valuenow={progreso.hechos}>
              <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${progreso.total ? Math.round((progreso.hechos / progreso.total) * 100) : 4}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Las decisiones se toman en olas de {OLA_TEXTO}: cada una se revalida con la carga y el tope de cuentas grandes antes de aceptarla.</p>
          </Tarjeta>
        )}
        {error && <p role="alert" className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

        {!prev && !progreso && (
          <Tarjeta>
            <p className="mb-3 text-sm text-slate-600">Configura el reparto y pulsa <b>Previsualizar</b>. No se guarda nada hasta que lo ejecutes. Puedes filtrar la tabla y marcar solo los registros que quieras repartir.</p>
            {seleccion.size > 0 && alcance !== "seleccion" && (
              <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
                Tienes {seleccion.size} registros seleccionados.
                <button className={boton("primario")} onClick={() => setAlcance("seleccion")}>Repartir solo estos</button>
              </p>
            )}
            <TablaRegistros datos={datos} base={pendientes} seleccion={seleccion} setSeleccion={setSeleccion} abrir={abrir} estadoFijo alto="38rem" />
          </Tarjeta>
        )}

        {prev && (
          <>
            <Tarjeta>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Titulo>Previsualización{todo ? " · repartir todo con IA" : ""}</Titulo>
                  <p className="text-sm text-slate-600">Así quedaría el reparto. <b>Todavía no se guardó nada</b>: revisa y pulsa Ejecutar.</p>
                </div>
                <div className="flex gap-2">
                  <button className={boton()} onClick={() => { setPrev(null); setPrevSol(null); }}>Descartar</button>
                  <button className={boton("primario")} disabled={cargando || !prev.resumen.asignables || !actor || desactualizada} onClick={ejecutar}>Ejecutar reparto</button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ResumenCifra valor={prev.resumen.asignables} etiqueta="se asignarían" tono="text-emerald-700" />
                <ResumenCifra valor={prev.resumen.retenidos} etiqueta="retenidos para revisión" tono="text-amber-700" />
                <ResumenCifra valor={prev.resumen.sin_candidato} etiqueta="sin vendedor válido" tono={prev.resumen.sin_candidato ? "text-rose-700" : "text-slate-900"} />
                <ResumenCifra valor={prev.sin_procesar ?? 0} etiqueta="quedan para la siguiente corrida" tono="text-slate-900" />
              </div>
              {prev.avisos?.map((a) => <p key={a} role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{a}</p>)}
              {usarNotas && prev.notas && prev.notas.distintas > 0 && (
                <p className="mt-3 text-xs text-slate-500">Notas leídas con IA: {prev.notas.distintas} textos distintos ({prev.notas.nuevas === 0 ? "todos tomados del caché, sin costo" : `${prev.notas.nuevas} nuevos leídos ahora, el resto del caché`}).</p>
              )}
              {desactualizada && (
                <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Cambiaste la configuración después de previsualizar. Lo que ves ya no es lo que se ejecutaría: pulsa <b>Previsualizar reparto</b> otra vez.
                </p>
              )}
              {cambioPorUsuario.length > 0 && (
                <>
                  <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Cómo queda la carga de quienes reciben</h3>
                  <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                    {cambioPorUsuario.map((u) => (
                      <div key={u.id}>
                        <p className="mb-1 flex items-center gap-2 text-sm text-slate-700"><Avatar nombre={u.nombre} tam={22} />{u.nombre}</p>
                        <BarraOcupacion valor={prev.cargaInicial[u.id] ?? 0} extra={(prev.cargaFinal[u.id] ?? 0) - (prev.cargaInicial[u.id] ?? 0)} max={u.capacidad_efectiva} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Tarjeta>

            <Tarjeta>
              <Titulo>A quién iría cada empresa</Titulo>
              <ul className="divide-y divide-slate-100">
                {prev.propuestas.map((p) => {
                  const r = regs.get(p.registro_id)!;
                  const abierto = abiertos.has(p.registro_id);
                  const simple = p.usuario_id ? explicarAsignacion({ metodo: prev.metodo, motivo: p.motivo, usuario_id: p.usuario_id, candidatos: p.candidatos }) : p.motivo;
                  return (
                    <li key={p.registro_id}>
                      <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-3 text-left hover:bg-slate-50" aria-expanded={abierto} onClick={() => alternar(p.registro_id)}>
                        <span className="w-4 text-xs text-slate-400">{abierto ? "▾" : "▸"}</span>
                        <span className="min-w-56 flex-1">
                          <span className="block font-medium text-slate-900">{r.razon_social}</span>
                          <span className="block text-xs text-slate-500">{r.zona ?? "zona sin dato"}{alcance !== "pendientes" && <> · hoy con {p.dueno_actual ? nombre(p.dueno_actual) : "nadie"}</>}</span>
                        </span>
                        <Badge tono={p.segmento === "corporativo" ? "marca" : p.segmento === "industrial" ? "azul" : "gris"}>{p.segmento}</Badge>
                        <span className="flex min-w-56 items-center gap-2">
                          {p.usuario_id
                            ? <><IconoFlecha tam={14} /><Avatar nombre={nombre(p.usuario_id)} tam={28} /><b className="text-slate-900">{nombre(p.usuario_id)}</b></>
                            : <Badge tono="rojo">sin vendedor válido</Badge>}
                        </span>
                        <Banderas lista={p.banderas_decision} />
                      </button>
                      {abierto && (
                        <div className="mb-3 ml-8 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Por qué</p>
                            <p className="mt-1 text-slate-800">{simple}</p>
                          </div>
                          {p.senales && (
                            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600">Lo que se leyó en la nota: <LecturaNota senales={p.senales} /><span className="italic">{p.senales.razon}</span></p>
                          )}
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Quiénes competían</p>
                            <TablaCandidatos candidatos={p.candidatos} elegidoId={p.usuario_id} />
                          </div>
                          {p.prompt_enviado && (
                            <details className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                              <summary className="cursor-pointer font-medium text-slate-600">Evidencia técnica para auditoría ({p.modelo ?? "modelo"})</summary>
                              <p className="mt-2 text-slate-500">La prueba pide poder reconstruir cada decisión de la IA, así que se guarda lo que se le envió y lo que respondió. No hace falta leerlo para operar.</p>
                              <p className="mt-2 font-medium text-slate-600">Lo que se le envió</p>
                              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">{p.prompt_enviado}</pre>
                              <p className="mt-2 font-medium text-slate-600">Lo que respondió</p>
                              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">{p.respuesta_modelo ?? "(sin respuesta)"}</pre>
                            </details>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>

            {prev.retenidos.length > 0 && (
              <Tarjeta>
                <Titulo>Retenidos para revisión humana ({prev.retenidos.length})</Titulo>
                <p className="mb-3 text-sm text-slate-600">No se reparten solos: alguien debe decidir qué hacer con cada uno.</p>
                <ul className="divide-y divide-slate-100">
                  {prev.retenidos.map((x) => (
                    <li key={x.registro_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <button className="text-left font-medium text-brand-700 hover:underline" onClick={() => abrir(x.registro_id)}>{regs.get(x.registro_id)?.razon_social}</button>
                      <span className="flex flex-wrap gap-1">{x.razones.map((z) => <Badge key={z} tono="ambar">{razonLegible(z)}</Badge>)}</span>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            )}
          </>
        )}
      </div>
    </div>
  );
}

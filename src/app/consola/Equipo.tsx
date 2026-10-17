"use client";

import { useState } from "react";
import { fmtMoneda, type Datos, type UsuarioConsola } from "@/lib/cliente";
import { TONO_NIVEL } from "./Candidatos";
import { Avatar, Badge, BarraOcupacion, Tarjeta } from "./ui";

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
type Etiqueta = { texto: string; tono: "rojo" | "ambar" | "verde" | "marca" | "gris"; titulo?: string };

/** Qué impide o condiciona que un vendedor reciba cuentas hoy. Sin etiquetas problemáticas = disponible. */
function etiquetasDe(u: UsuarioConsola): { problemas: Etiqueta[]; disponible: boolean } {
  const cap = u.capacidad_efectiva;
  const p: Etiqueta[] = [];
  if (!u.activo) p.push({ texto: "inactivo", tono: "rojo" });
  if (u.ausencia) p.push({ texto: `ausente: ${u.ausencia.motivo.toLowerCase()}`, tono: "ambar", titulo: `${u.ausencia.desde} a ${u.ausencia.hasta ?? "sin fecha de fin"}` });
  else if (u.ausencia_proxima) p.push({ texto: `se ausenta el ${fechaCorta(u.ausencia_proxima.desde)}`, tono: "ambar", titulo: `${u.ausencia_proxima.motivo}: ${u.ausencia_proxima.desde} a ${u.ausencia_proxima.hasta ?? "sin fecha de fin"}. No recibe cuentas nuevas.` });
  if (u.activo && !cap) p.push({ texto: "sin capacidad", tono: "rojo", titulo: "Capacidad vacía o 0: no puede recibir cuentas." });
  if (u.activo && cap && u.carga >= cap) p.push({ texto: "sin cupo", tono: "ambar" });
  return { problemas: p, disponible: p.length === 0 };
}

const MARCA_SEGMENTO = { corporativo: "bg-brand-600", industrial: "bg-sky-500", pyme: "bg-slate-300" } as const;

/** Barra apilada con la mezcla de la cartera: se ve de un vistazo si es de cuentas grandes o pequeñas. */
function Mezcla({ corp, ind, pyme }: { corp: number; ind: number; pyme: number }) {
  const total = corp + ind + pyme;
  if (!total) return <p className="text-xs text-slate-400">sin cuentas todavía</p>;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${corp} corporativas, ${ind} industriales, ${pyme} pyme`}>
        <div className={MARCA_SEGMENTO.corporativo} style={{ width: `${(corp / total) * 100}%` }} />
        <div className={MARCA_SEGMENTO.industrial} style={{ width: `${(ind / total) * 100}%` }} />
        <div className={MARCA_SEGMENTO.pyme} style={{ width: `${(pyme / total) * 100}%` }} />
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-slate-600">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-brand-600" />{corp} corporativas</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />{ind} industriales</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-300" />{pyme} pyme</span>
      </p>
    </div>
  );
}

function FichaVendedor({ u }: { u: UsuarioConsola }) {
  const k = u.perfil;
  const { problemas, disponible } = etiquetasDe(u);
  const extra = u.banderas.filter((b) => b !== "zona_normalizada");
  return (
    <article className={`flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm ${disponible ? "border-slate-200" : "border-amber-200"}`}>
      <header className="flex items-start gap-3">
        <Avatar nombre={u.nombre} tam={40} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900">{u.nombre}</h3>
          <p className="text-xs text-slate-500">{u.zona ?? "zona sin dato"} · especialista en {u.segmento_experto ?? "sin dato"}</p>
        </div>
        {disponible && <Badge tono="verde">disponible</Badge>}
      </header>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge tono={TONO_NIVEL[k.nivel]}>{k.nivel}</Badge>
        <span className="text-slate-500">{k.antiguedadEstimada ? "sin fecha de ingreso (se asume senior)" : `${((k.antiguedadDias ?? 0) / 365).toFixed(1)} años en la empresa`}</span>
      </div>

      {(problemas.length > 0 || extra.length > 0 || u.capacidad_provisional) && (
        <div className="flex flex-wrap gap-1">
          {u.capacidad_provisional && <Badge tono="marca" titulo="Capacidad real 0. Se le da una provisional y solo recibe cuentas pyme.">{`rampa: capacidad provisional ${u.capacidad_efectiva}`}</Badge>}
          {problemas.map((e) => <Badge key={e.texto} tono={e.tono} titulo={e.titulo}>{e.texto}</Badge>)}
          {extra.map((b) => <Badge key={b} tono={/inexistente|cero/.test(b) ? "rojo" : "gris"}>{b.replaceAll("_", " ")}</Badge>)}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Carga</p>
        <BarraOcupacion valor={u.carga} max={u.capacidad_efectiva} />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Cartera · {k.cuentas} {k.cuentas === 1 ? "cuenta" : "cuentas"} · {fmtMoneda(k.ingresos)}</p>
        <Mezcla corp={k.corporativo} ind={k.industrial} pyme={k.pyme} />
      </div>

      <p className="mt-auto border-t border-slate-100 pt-2 text-xs text-slate-500">
        {k.diasDesdeUltima === null ? "Sin actividad registrada" : `Última actividad hace ${k.diasDesdeUltima} días`}
        {" · "}{k.acciones14d} {k.acciones14d === 1 ? "acción" : "acciones"} en 14 días
        {k.frias > 0 && <> · <b className="font-medium text-amber-700">{k.frias} {k.frias === 1 ? "cuenta fría" : "cuentas frías"}</b></>}
      </p>
    </article>
  );
}

export function Equipo({ datos }: { datos: Datos }) {
  const [filtro, setFiltro] = useState<"todos" | "disponibles" | "atencion">("todos");
  const [zona, setZona] = useState("");
  const vendedores = datos.usuarios.filter((u) => u.rol === "vendedor").sort((a, b) => (a.zona ?? "").localeCompare(b.zona ?? "") || a.id - b.id);
  const otros = datos.usuarios.filter((u) => u.rol !== "vendedor");
  const disp = vendedores.filter((u) => etiquetasDe(u).disponible).length;
  const visibles = vendedores.filter((u) => (!zona || u.zona === zona) && (filtro === "todos" || (filtro === "disponibles") === etiquetasDe(u).disponible));
  const zonas = [...new Set(vendedores.map((u) => u.zona).filter((z): z is string => !!z))].sort();
  const chip = (id: typeof filtro, texto: string) => (
    <button key={id} onClick={() => setFiltro(id)} aria-pressed={filtro === id}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${filtro === id ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{texto}</button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {chip("todos", `Todos (${vendedores.length})`)}
          {chip("disponibles", `Disponibles (${disp})`)}
          {chip("atencion", `Requieren atención (${vendedores.length - disp})`)}
        </div>
        <select aria-label="Zona" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm" value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="">Todas las zonas</option>{zonas.map((z) => <option key={z}>{z}</option>)}
        </select>
      </div>

      <details className="rounded-lg bg-white px-4 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
        <summary className="cursor-pointer font-medium text-slate-700">¿Cómo se lee esta vista?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Datos a la fecha de operación <b>{datos.fecha}</b>.</li>
          <li><b>Carga</b>: cuentas que tiene hoy sobre su capacidad máxima (lo ocupado, no lo libre).</li>
          <li><b>Cartera</b>: cuentas autoasignadas, asignadas o en gestión cuyo último movimiento es suyo. Una cuenta es <b>fría</b> si lleva 30 días o más sin movimiento.</li>
          <li><b>Nivel</b> por antigüedad: rampa (menos de 6 meses), junior (menos de 2 años), pleno (menos de 4) y senior.</li>
        </ul>
      </details>

      {visibles.length === 0
        ? <Tarjeta><p className="text-sm text-slate-500">Ningún vendedor cumple ese filtro.</p></Tarjeta>
        : <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{visibles.map((u) => <FichaVendedor key={u.id} u={u} />)}</div>}

      {otros.length > 0 && (
        <p className="text-xs text-slate-500">
          No reciben cuentas en el reparto (salvo que se incluyan líderes en los parámetros): {otros.map((u) => `${u.nombre} (${u.rol})`).join(", ")}.
        </p>
      )}
    </div>
  );
}

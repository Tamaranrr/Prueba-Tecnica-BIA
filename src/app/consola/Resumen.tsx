"use client";

import { useMemo } from "react";
import type { Datos, RegistroConsola, UsuarioConsola } from "@/lib/cliente";
import { esperaDe } from "./TablaRegistros";
import { Badge, BarraOcupacion, boton, Tarjeta, Titulo, type Tono } from "./ui";

interface Alerta {
  id: string; tono: Tono; titulo: string; detalle: string; registros?: RegistroConsola[]; vendedores?: UsuarioConsola[];
  accion: string; alAccionar: () => void;
}

const MAX_NOMBRES = 4;

export function Resumen({ datos, abrir, irA }: { datos: Datos; abrir: (id: number) => void; irA: (tab: "reparto" | "registros" | "equipo" | "auditoria" | "comparador") => void }) {
  const r = useMemo(() => {
    const pend = datos.registros.filter((x) => x.estado === "nuevo");
    const retenidos = pend.filter((x) => x.retenido);
    const dup = retenidos.filter((x) => x.retenido!.some((z) => z.startsWith("duplicado")));
    const noInsistir = retenidos.filter((x) => x.retenido!.some((z) => /no_contactar|no_insistir/.test(z)));
    const sinCand = pend.filter((x) => datos.sin_candidato.includes(x.id));
    const viejos = pend.filter((x) => (esperaDe(x, datos.fecha) ?? 0) >= 14);
    const vend = datos.usuarios.filter((u) => u.rol === "vendedor");
    const sinCupo = vend.filter((u) => u.activo && !u.ausencia && u.capacidad_efectiva !== null && u.carga >= u.capacidad_efectiva);
    const fuera = vend.filter((u) => !u.activo || u.ausencia || u.ausencia_proxima);
    const asignables = pend.length - retenidos.length - sinCand.length;
    const vivos = datos.registros.filter((x) => ["asignado", "autoasignado", "en_gestion"].includes(x.estado));
    const cap = vend.filter((u) => u.activo && u.capacidad_efectiva).reduce((s, u) => s + (u.capacidad_efectiva ?? 0), 0);
    const uso = vend.filter((u) => u.activo && u.capacidad_efectiva).reduce((s, u) => s + u.carga, 0);
    const porEstado = ["nuevo", "autoasignado", "asignado", "en_gestion", "descartado"].map((e) => ({ e, n: datos.registros.filter((x) => x.estado === e).length }));
    const llenos = [...vend].filter((u) => u.activo && u.capacidad_efectiva).sort((a, b) => b.carga / (b.capacidad_efectiva ?? 1) - a.carga / (a.capacidad_efectiva ?? 1)).slice(0, 5);
    return { pend, retenidos, dup, noInsistir, sinCand, viejos, sinCupo, fuera, asignables, vivos, cap, uso, porEstado, llenos };
  }, [datos]);

  const alertas: Alerta[] = [
    { id: "dup", tono: "rojo", titulo: "Posibles duplicados", detalle: "No se reparten solos: alguien debe confirmar si es la misma empresa.", registros: r.dup, accion: "Revisar en Registros", alAccionar: () => irA("registros") },
    { id: "noins", tono: "rojo", titulo: "Pidieron que no insistan", detalle: "Su nota pide no contactarlos. Se retienen para una decisión humana.", registros: r.noInsistir, accion: "Revisar en Registros", alAccionar: () => irA("registros") },
    { id: "sincand", tono: "ambar", titulo: "Sin vendedor válido", detalle: "Hoy ningún vendedor pasa los filtros duros para estas cuentas (capacidad, ausencias, antigüedad o segmento).", registros: r.sinCand, accion: "Ver el equipo", alAccionar: () => irA("equipo") },
    { id: "viejos", tono: "ambar", titulo: "Esperan 14 días o más", detalle: "Llevan dos semanas o más sin que nadie las toque.", registros: r.viejos, accion: "Repartir pendientes", alAccionar: () => irA("reparto") },
    { id: "cupo", tono: "ambar", titulo: "Vendedores sin cupo", detalle: "Están al máximo de su capacidad: no reciben más cuentas hasta liberar cartera.", vendedores: r.sinCupo, accion: "Ver el equipo", alAccionar: () => irA("equipo") },
    { id: "fuera", tono: "gris", titulo: "No disponibles", detalle: "Inactivos, ausentes o con una ausencia que empieza pronto.", vendedores: r.fuera, accion: "Ver el equipo", alAccionar: () => irA("equipo") },
  ].filter((a) => (a.registros?.length ?? a.vendedores?.length ?? 0) > 0);

  const ocupacion = r.cap ? Math.round((r.uso / r.cap) * 100) : 0;

  return (
    <div className="space-y-5">
      <Tarjeta className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Titulo>Listo para repartir</Titulo>
          <p className="text-3xl font-bold tabular-nums text-slate-900">{r.asignables} <span className="text-base font-medium text-slate-500">de {r.pend.length} pendientes se pueden asignar hoy</span></p>
          <p className="mt-1 text-sm text-slate-600">
            {r.retenidos.length} se retienen para revisión humana
            {r.sinCand.length > 0 && <> y {r.sinCand.length} no tienen vendedor válido</>}. La ocupación del equipo es del <b>{ocupacion}%</b> (carga sobre capacidad; lo que queda libre es el {100 - ocupacion}%).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={boton("primario")} onClick={() => irA("reparto")}>Ir a repartir</button>
          <button className={boton()} onClick={() => irA("comparador")}>Comparar métodos</button>
        </div>
      </Tarjeta>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Titulo>Alertas de calidad</Titulo>
          {alertas.length === 0 && <Tarjeta><p className="text-sm text-slate-600">Sin alertas: los pendientes se pueden repartir sin revisión previa.</p></Tarjeta>}
          {alertas.map((a) => (
            <Tarjeta key={a.id} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-slate-900">
                    <Badge tono={a.tono}>{a.registros?.length ?? a.vendedores?.length}</Badge>{a.titulo}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{a.detalle}</p>
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {a.registros?.slice(0, MAX_NOMBRES).map((x) => (
                      <button key={x.id} className="text-brand-700 underline decoration-brand-200 hover:decoration-brand-600" onClick={() => abrir(x.id)}>{x.razon_social}</button>
                    ))}
                    {a.vendedores?.slice(0, MAX_NOMBRES).map((u) => <span key={u.id} className="text-slate-700">{u.nombre}</span>)}
                    {(a.registros?.length ?? a.vendedores?.length ?? 0) > MAX_NOMBRES && <span className="text-slate-500">y {(a.registros?.length ?? a.vendedores?.length ?? 0) - MAX_NOMBRES} más</span>}
                  </p>
                </div>
                <button className={boton()} onClick={a.alAccionar}>{a.accion}</button>
              </div>
            </Tarjeta>
          ))}
        </div>

        <div className="space-y-5">
          <Tarjeta>
            <Titulo>Estado de los registros</Titulo>
            <ul className="space-y-1.5 text-sm">
              {r.porEstado.map(({ e, n }) => (
                <li key={e} className="flex items-center justify-between">
                  <Badge tono={e === "nuevo" ? "ambar" : e === "autoasignado" ? "azul" : e === "descartado" ? "gris" : "verde"}>{e.replaceAll("_", " ")}</Badge>
                  <b className="tabular-nums">{n}</b>
                </li>
              ))}
            </ul>
          </Tarjeta>
          <Tarjeta>
            <Titulo>Más cargados</Titulo>
            <ul className="space-y-3">
              {r.llenos.map((u: UsuarioConsola) => (
                <li key={u.id}><p className="mb-1 text-sm text-slate-700">{u.nombre.replace(/\s*\(.*\)\s*$/, "")}</p><BarraOcupacion valor={u.carga} max={u.capacidad_efectiva} /></li>
              ))}
            </ul>
            <button className={`${boton()} mt-4 w-full`} onClick={() => irA("equipo")}>Ver todo el equipo</button>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}

"use client";

import { fmtMoneda, type Datos, type UsuarioConsola } from "@/lib/cliente";
import { TONO_NIVEL } from "./Candidatos";
import { Badge, Banderas, Barra, Tarjeta } from "./ui";

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Todo lo que impide o condiciona que un vendedor reciba cuentas hoy, en una sola fila de etiquetas. */
function Estado({ u }: { u: UsuarioConsola }) {
  const cap = u.capacidad_efectiva;
  const llena = !!cap && u.carga >= cap;
  const etiquetas: { texto: string; tono: "rojo" | "ambar" | "verde" | "marca" | "gris"; titulo?: string }[] = [];
  // Líderes y administradores no reciben cuentas en el reparto (salvo que se pida): no se les muestra como "disponibles".
  if (u.rol !== "vendedor") return <Badge tono="gris" titulo="El reparto solo asigna a vendedores; los líderes pueden incluirse desde los parámetros.">no recibe cuentas</Badge>;
  if (!u.activo) etiquetas.push({ texto: "inactivo", tono: "rojo" });
  if (u.ausencia) etiquetas.push({ texto: `ausente: ${u.ausencia.motivo.toLowerCase()}`, tono: "ambar", titulo: `${u.ausencia.desde} a ${u.ausencia.hasta ?? "sin fecha de fin"}` });
  else if (u.ausencia_proxima) etiquetas.push({ texto: `se ausenta el ${fechaCorta(u.ausencia_proxima.desde)}`, tono: "ambar", titulo: `${u.ausencia_proxima.motivo}: ${u.ausencia_proxima.desde} a ${u.ausencia_proxima.hasta ?? "sin fecha de fin"}. No recibe cuentas nuevas.` });
  if (u.activo && !cap) etiquetas.push({ texto: "sin capacidad", tono: "rojo", titulo: "Capacidad vacía o 0: no puede recibir cuentas." });
  if (u.capacidad_provisional) etiquetas.push({ texto: `rampa: capacidad provisional ${cap}`, tono: "marca", titulo: "Capacidad real 0. Se le da una provisional y solo recibe cuentas pyme." });
  if (u.activo && llena) etiquetas.push({ texto: "sin cupo", tono: "ambar" });
  if (!etiquetas.length) etiquetas.push({ texto: "disponible", tono: "verde" });
  return <span className="flex flex-wrap gap-1">{etiquetas.map((e) => <Badge key={e.texto} tono={e.tono} titulo={e.titulo}>{e.texto}</Badge>)}</span>;
}

export function Equipo({ datos }: { datos: Datos }) {
  const peso = { vendedor: 0, lider: 1, admin: 2 } as const;
  const orden = [...datos.usuarios].sort((a, b) => peso[a.rol] - peso[b.rol] || (a.zona ?? "").localeCompare(b.zona ?? "") || a.id - b.id);
  return (
    <Tarjeta>
      <p className="mb-3 text-sm text-slate-500">
        Lo que cada vendedor tiene hoy, a la fecha de operación <b>{datos.fecha}</b>. Cartera = cuentas autoasignadas, asignadas o en gestión cuyo último movimiento es suyo.
        Cuenta fría = sin movimiento en 30 días o más. Nivel por antigüedad: rampa (menos de 6 meses), junior (menos de 2 años), pleno (menos de 4) y senior.
      </p>
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr><th className="py-1">Usuario</th><th>Zona</th><th>Especialidad</th><th>Nivel</th><th>Carga</th><th>Cartera por segmento</th><th>Actividad</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {orden.map((u) => {
              const k = u.perfil;
              const asignable = u.rol === "vendedor";
              return (
                <tr key={u.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{u.nombre}</div>
                    <div className="text-xs text-slate-500">{u.rol}{!asignable ? " (no recibe cuentas)" : ""}</div>
                    <div className="mt-1"><Banderas lista={u.banderas.filter((b) => b !== "zona_normalizada")} /></div>
                  </td>
                  <td className="pr-3">{u.zona ?? "sin dato"}</td>
                  <td className="pr-3">{u.segmento_experto ?? "sin dato"}</td>
                  <td className="pr-3">
                    {u.rol === "admin" ? "no aplica" : <>
                      <Badge tono={TONO_NIVEL[k.nivel]}>{k.nivel}</Badge>
                      <div className="mt-1 text-xs text-slate-500">{k.antiguedadEstimada ? "sin fecha de ingreso (se asume senior)" : `${((k.antiguedadDias ?? 0) / 365).toFixed(1)} años`}</div>
                    </>}
                  </td>
                  <td className="pr-3">{u.rol === "admin" ? "no aplica" : <Barra valor={u.carga} max={u.capacidad_efectiva} />}</td>
                  <td className="pr-3">
                    {u.rol === "admin" ? "no aplica" : <>
                      <div><b>{k.cuentas}</b> {k.cuentas === 1 ? "cuenta" : "cuentas"}: {k.corporativo} corp · {k.industrial} ind · {k.pyme} pyme</div>
                      <div className="text-xs text-slate-500">Suman {fmtMoneda(k.ingresos)} en ingresos</div>
                    </>}
                  </td>
                  <td className="pr-3">
                    {u.rol === "admin" ? "no aplica" : <>
                      <div>{k.acciones14d} acciones en 14 días</div>
                      <div className="text-xs text-slate-500">{k.diasDesdeUltima === null ? "sin actividad registrada" : `última hace ${k.diasDesdeUltima} días`}{k.frias > 0 ? ` · ${k.frias} cuenta${k.frias === 1 ? "" : "s"} fría${k.frias === 1 ? "" : "s"}` : ""}</div>
                    </>}
                  </td>
                  <td><Estado u={u} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

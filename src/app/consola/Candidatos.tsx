"use client";

import { fmtMoneda } from "@/lib/cliente";
import type { EvaluacionCandidato, Nivel } from "@/lib/engine/tipos";
import { Badge, type Tono } from "./ui";

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Convierte un código de descarte del motor en una frase que entiende quien opera la consola. */
export function textoDescarte(d: string): string {
  let m: RegExpMatchArray | null;
  if ((m = d.match(/^se_ausenta_el_(\d{4}-\d{2}-\d{2})\((.*)\)$/))) return `se ausenta el ${fechaCorta(m[1])} (${m[2].toLowerCase()})`;
  if ((m = d.match(/^ausente\((.*)\)$/))) return `ausente (${m[1].toLowerCase()})`;
  if ((m = d.match(/^en_rampa_solo_cuentas_pyme\(cuenta (.*)\)$/))) return `en rampa: solo recibe cuentas pyme (esta es ${m[1]})`;
  if (d === "es_el_dueno_actual") return "ya es el dueño de la cuenta";
  if ((m = d.match(/^aun_no_ingresa\((.*)\)$/))) return `aún no ingresa (${m[1]})`;
  if ((m = d.match(/^sin_cupo\((.*)\)$/))) return `sin cupo (${m[1]})`;
  if ((m = d.match(/^otra_zona\((.*)\)$/))) return `otra zona (${m[1]})`;
  if (d === "excluido_del_lote") return "excluido de este reparto";
  return d.replaceAll("_", " ");
}

export const TONO_NIVEL: Record<Nivel, Tono> = { rampa: "ambar", junior: "gris", pleno: "marca", senior: "verde" };

/** Candidatos de una decisión: quién fue elegido, quién fue descartado y por qué, y qué cartera tenía cada uno al decidir. */
export function TablaCandidatos({ candidatos, elegidoId }: { candidatos: EvaluacionCandidato[]; elegidoId: number | null }) {
  // Líderes y administradores no reciben cuentas: se omiten para que la tabla muestre solo a quienes de verdad compiten.
  const visibles = candidatos.filter((c) => !c.descartes.some((d) => d.startsWith("rol_")));
  const ocultos = candidatos.length - visibles.length;
  return (
    <>
    <table className="w-full text-xs">
      <thead className="text-left text-slate-400">
        <tr><th>Candidato</th><th>Nivel</th><th>Carga</th><th>Cartera al decidir</th><th>Puntaje</th><th>Detalle</th></tr>
      </thead>
      <tbody>
        {visibles.map((c) => {
          const k = c.cartera;
          return (
            <tr key={c.usuario_id} className={`border-t border-slate-200 align-top ${c.usuario_id === elegidoId ? "bg-emerald-50 font-medium" : ""}`}>
              <td className="py-1.5 pr-2">{c.nombre}</td>
              <td className="pr-2">{k ? <Badge tono={TONO_NIVEL[k.nivel]}>{k.nivel}{k.antiguedadEstimada ? " (estimado)" : ""}</Badge> : "sin dato"}</td>
              <td className="pr-2 whitespace-nowrap">{c.carga}/{c.capacidad ?? "sin dato"}{c.capacidad_provisional && <span className="ml-1 text-amber-700" title="Capacidad provisional de un recién entrado">(prov.)</span>}</td>
              <td className="pr-2" title={k ? `Ingresos en cartera: ${fmtMoneda(k.ingresos)}. ${k.acciones14d} acciones en 14 días. ${k.diasDesdeUltima === null ? "Sin actividad registrada" : `Última actividad hace ${k.diasDesdeUltima} días`}. ${k.frias} cuentas frías.` : undefined}>
                {k ? `${k.cuentas} ${k.cuentas === 1 ? "cuenta" : "cuentas"}: ${k.corporativo} corp · ${k.industrial} ind · ${k.pyme} pyme` : "sin dato"}
              </td>
              <td className="pr-2">{c.puntaje ?? "sin dato"}</td>
              <td>
                {c.elegible
                  ? (c.desglose ? Object.entries(c.desglose).map(([k2, v]) => `${k2.replaceAll("_", " ")} ${v}`).join(" · ") : "elegible")
                  : <span className="text-red-700">descartado: {c.descartes.map(textoDescarte).join(", ")}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    {ocultos > 0 && <p className="mt-1 text-xs text-slate-400">No se muestran {ocultos} líderes o administradores: no reciben cuentas en el reparto.</p>}
    </>
  );
}

/** Versión corta de un descarte, para una lista que se lee de corrido. */
function descarteCorto(d: string): string {
  if (/^cuenta_corporativa_pide/.test(d)) return "lleva menos de 2 años y la cuenta es grande";
  if (/^en_rampa/.test(d)) return "es nuevo: solo recibe cuentas pequeñas";
  if (/^se_ausenta_el_/.test(d)) return textoDescarte(d).replace(/^se ausenta el (\d\d\/\d\d).*$/, "se ausenta el $1");
  if (/^ausente\(/.test(d)) return textoDescarte(d);
  if (/^sin_capacidad|capacidad/.test(d)) return "sin capacidad definida";
  if (d === "inactivo") return "está inactivo";
  return textoDescarte(d);
}

/**
 * Quiénes competían por una cuenta, dicho sin tecnicismos: a la izquierda quienes podían recibirla (el elegido marcado)
 * y a la derecha quienes no, con una sola razón corta cada uno. La tabla técnica completa queda en el detalle del registro.
 */
export function CandidatosSimple({ candidatos, elegidoId }: { candidatos: EvaluacionCandidato[]; elegidoId: number | null }) {
  const visibles = candidatos.filter((c) => !c.descartes.some((d) => d.startsWith("rol_")));
  const pueden = visibles.filter((c) => c.elegible).sort((a, b) => Number(b.usuario_id === elegidoId) - Number(a.usuario_id === elegidoId) || (a.carga / (a.capacidad || 1)) - (b.carga / (b.capacidad || 1)));
  const noPueden = visibles.filter((c) => !c.elegible);
  const razon = (c: EvaluacionCandidato) => [...new Set(c.descartes.map(descarteCorto))].filter((x, _i, arr) => !(x.startsWith("es nuevo") && arr.some((y) => y.startsWith("lleva menos")))).join("; ");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-600">Podían recibirla ({pueden.length})</p>
        <ul className="space-y-1">
          {pueden.map((c) => {
            const elegido = c.usuario_id === elegidoId;
            return (
              <li key={c.usuario_id} className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm ${elegido ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-white ring-1 ring-slate-100"}`}>
                <span className="min-w-0 truncate">{elegido && <span className="mr-1 text-emerald-700">✓</span>}<span className={elegido ? "font-semibold text-slate-900" : "text-slate-700"}>{c.nombre}</span></span>
                <span className="shrink-0 text-xs text-slate-500">{c.carga} de {c.capacidad ?? "?"} cuentas{elegido && <b className="ml-2 text-emerald-700">elegido</b>}</span>
              </li>
            );
          })}
          {pueden.length === 0 && <li className="text-xs text-slate-500">Nadie podía recibirla.</li>}
        </ul>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-600">No podían ({noPueden.length})</p>
        <ul className="space-y-1">
          {noPueden.map((c) => (
            <li key={c.usuario_id} className="rounded-lg bg-white px-2.5 py-1.5 text-sm ring-1 ring-slate-100">
              <span className="text-slate-700">{c.nombre}</span> <span className="text-xs text-slate-500">· {razon(c)}</span>
            </li>
          ))}
          {noPueden.length === 0 && <li className="text-xs text-slate-500">Nadie quedó fuera.</li>}
        </ul>
      </div>
    </div>
  );
}

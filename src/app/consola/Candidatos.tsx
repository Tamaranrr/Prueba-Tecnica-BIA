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
                {k ? `${k.cuentas} cuentas: ${k.corporativo} corp · ${k.industrial} ind · ${k.pyme} pyme` : "sin dato"}
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

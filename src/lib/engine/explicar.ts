import type { EvaluacionCandidato } from "./tipos";

/**
 * Explica una asignación en lenguaje simple, para quien opera la consola y no necesita leer puntajes.
 * Solo usa lo que quedó guardado en la traza: el método, el motivo y la evaluación de los candidatos.
 */
/** Recorta en el último punto que cabe, para no dejar una frase cortada a la mitad. */
function recortarEnFrase(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const punto = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf(".\n"));
  return punto > 40 ? corte.slice(0, punto + 1) : `${corte.trimEnd()}...`;
}

export function explicarAsignacion(a: {
  metodo: string; motivo: string | null; usuario_id: number; candidatos: EvaluacionCandidato[] | null;
}): string {
  const motivo = (a.motivo ?? "").trim();
  if (a.metodo === "manual") return motivo.replace(/^Reasignación manual:\s*/i, "Reasignación manual: ") || "Reasignación manual.";

  const elegido = a.candidatos?.find((c) => c.usuario_id === a.usuario_id);
  const compitieron = (a.candidatos ?? []).filter((c) => c.elegible).length;
  const frases: string[] = [];

  if (a.metodo === "ia") {
    // El modelo ya escribió una razón en lenguaje natural: se muestra tal cual, sin el prefijo técnico ni la nota del motor.
    const razon = motivo.replace(/^IA \([^)]*\):\s*/, "").replace(/\s*\[[^\]]*\]\s*$/, "").trim();
    const respaldo = /^Respaldo por balanceo de carga:/.test(motivo);
    if (respaldo) return "La IA no pudo decidir este caso y se asignó a quien tenía menos carga.";
    return recortarEnFrase(razon, 240);
  }

  if (a.metodo === "round_robin") {
    return `Le tocaba el turno: el reparto rota entre los vendedores disponibles y da más turnos a quien tiene más cupo libre${elegido ? ` (tenía ${elegido.carga} de ${elegido.capacidad})` : ""}.`;
  }

  if (elegido && elegido.capacidad) {
    const cap = elegido.capacidad;
    const ocup = Math.round((elegido.carga / cap) * 100);
    const otros = (a.candidatos ?? []).filter((c) => c.elegible && c.usuario_id !== a.usuario_id && c.capacidad);
    const masCargados = otros.filter((c) => (c.carga / (c.capacidad as number)) > elegido.carga / cap).length;
    if (a.metodo === "balanceo_carga") {
      return `Era de quienes tenían menos carga: ${elegido.carga} de ${elegido.capacidad} cuentas (${ocup} %), ${masCargados > 0 ? `menos que otros ${masCargados} de los ${compitieron} que podían recibirla` : "la menor entre los que podían recibirla"}.`;
    }
    const d = elegido.desglose ?? {};
    if ((d.segmento ?? 0) > 0) frases.push("es experto en el tipo de cuenta");
    if ((d.zona ?? 0) > 0) frases.push("es de la misma zona");
    if ((d.necesidad_industrial ?? 0) > 0) frases.push("la cuenta pide un perfil industrial");
    if ((d.balance_grandes ?? 0) >= 10) frases.push(`tiene pocas cuentas grandes${elegido.cartera ? ` (${elegido.cartera.corporativo})` : ""}`);
    if (masCargados > 0 || ocup <= 50) frases.push(`tiene carga baja (${ocup} %)`);
    if (elegido.cartera) {
      const n = { rampa: "recién entrado, se está nivelando", junior: "de nivel junior", pleno: "de nivel pleno", senior: "de nivel senior" }[elegido.cartera.nivel];
      if ((d.antiguedad ?? 0) > 0 || elegido.cartera.nivel === "rampa") frases.push(n);
    }
  }
  const nota = motivo.match(/lo que dice la nota \(([^)]*)\) se aplicó/);
  if (nota) frases.push(`la nota pedía: ${nota[1]}`);
  if (/solo compiten expertos corporativos/.test(motivo)) frases.push("las cuentas corporativas van primero a expertos corporativos");
  if (/ya tienen \d+ o más cuentas grandes/.test(motivo)) frases.push("los expertos corporativos ya llegaron al tope de cuentas grandes");
  if (/se desbordó a otras zonas/.test(motivo)) frases.push("no había nadie disponible en su zona");

  if (!frases.length) return motivo || "Asignada por el motor.";
  const lista = frases.length === 1 ? frases[0] : `${frases.slice(0, -1).join(", ")} y ${frases.at(-1)}`;
  return `Se le asignó porque ${lista}.`;
}

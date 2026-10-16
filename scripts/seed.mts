// Carga los CSV de /data a Supabase, normalizando y marcando con banderas lo dudoso.
//   npm run seed:dry   → solo muestra el resumen de normalización (no toca la base)
//   npm run seed       → carga en Supabase (requiere haber corrido supabase/schema.sql)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, string>;
const DRY = process.argv.includes("--dry");
const leer = (f: string): Row[] =>
  parse(readFileSync(join(process.cwd(), "data", f), "utf8"), { columns: true, skip_empty_lines: true, bom: true, trim: true });

const vacio = (v?: string) => v === undefined || v.trim() === "";
const num = (v?: string) => (vacio(v) ? null : Number(v));
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// ───── Zonas ─────
const ZONAS: Record<string, string> = {
  centro: "Centro", costa: "Costa", occidente: "Occidente", antioquia: "Antioquia", ant: "Antioquia",
  bogota: "Centro", // decisión: Bogotá no es zona de ningún equipo → Centro (documentado en README)
};
function normZona(raw: string | undefined): { zona: string | null; bandera?: string } {
  if (vacio(raw)) return { zona: null };
  const k = sinTildes(raw!.trim().toLowerCase());
  const z = ZONAS[k];
  if (!z) return { zona: null, bandera: `zona_desconocida:${raw}` };
  return { zona: z, bandera: k === "bogota" ? "zona_bogota_asignada_a_centro" : undefined };
}

// ───── Equipos / usuarios ─────
const equiposCsv = leer("equipos.csv");
const equipoIds = new Set(equiposCsv.map((e) => Number(e.id)));
const equipoZona = new Map(equiposCsv.map((e) => [Number(e.id), normZona(e.zona).zona]));
const equipos = equiposCsv.map((e) => ({
  id: Number(e.id), nombre: e.nombre, lider_id: num(e.lider_id), zona: normZona(e.zona).zona!,
}));

const usuarios = leer("usuarios.csv").map((u) => {
  const banderas: string[] = [];
  let equipo_id = num(u.equipo_id);
  if (equipo_id !== null && !equipoIds.has(equipo_id)) { banderas.push(`equipo_inexistente:${equipo_id}`); equipo_id = null; }
  let { zona, bandera } = normZona(u.zona);
  if (bandera) banderas.push(bandera);
  if (!zona && equipo_id !== null && equipoZona.get(equipo_id)) { zona = equipoZona.get(equipo_id)!; banderas.push("zona_heredada_del_equipo"); }
  if (!zona && u.rol !== "admin") banderas.push("sin_zona");
  const capacidad_maxima = num(u.capacidad_maxima);
  if (u.rol !== "admin" && capacidad_maxima === null) banderas.push("sin_capacidad");
  if (capacidad_maxima === 0) banderas.push("capacidad_cero");
  if (vacio(u.fecha_ingreso)) banderas.push("sin_fecha_ingreso");
  if (u.zona && u.zona !== normZona(u.zona).zona) banderas.push("zona_normalizada");
  return {
    id: Number(u.id), nombre: u.nombre, email: u.email, rol: u.rol, equipo_id, zona,
    segmento_experto: vacio(u.segmento_experto) ? null : u.segmento_experto.toLowerCase(),
    capacidad_maxima, fecha_ingreso: vacio(u.fecha_ingreso) ? null : u.fecha_ingreso,
    activo: u.activo.toLowerCase() === "true", banderas, datos_originales: u,
  };
});
const usuarioIds = new Set(usuarios.map((u) => u.id));

// ───── Registros ─────
const regsCsv = leer("registros.csv");

// ciudad → zona más frecuente entre registros que sí traen zona (para inferir las vacías)
const votos = new Map<string, Map<string, number>>();
for (const r of regsCsv) {
  const z = normZona(r.zona).zona;
  if (!z) continue;
  const m = votos.get(r.ciudad) ?? new Map();
  m.set(z, (m.get(z) ?? 0) + 1);
  votos.set(r.ciudad, m);
}
const zonaDeCiudad = (c: string) => {
  const m = votos.get(c);
  return m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
};

// clave de empresa para detectar duplicados: sin tildes, mayúsculas ni puntuación.
// OJO: NO se quita el sufijo societario: "X S.A.S." y "X Ltda." se consideran empresas distintas.
const claveEmpresa = (s: string) =>
  sinTildes(s.toLowerCase()).replace(/[.,]/g, "").replace(/\s+/g, " ").trim();

const BANDERAS_NOTA: [RegExp, string][] = [
  [/base comprada/i, "base_sin_validar"],
  [/no insistiéramos|no insistir/i, "pidio_no_insistir"],
  [/posible duplicado/i, "nota_posible_duplicado"],
];

const registros = regsCsv.map((r) => {
  const banderas: string[] = [];
  let { zona, bandera } = normZona(r.zona);
  if (bandera) banderas.push(bandera);
  if (r.zona && r.zona !== zona) banderas.push("zona_normalizada");
  if (!zona) {
    const inf = zonaDeCiudad(r.ciudad);
    if (inf) { zona = inf; banderas.push("zona_inferida_por_ciudad"); } else banderas.push("sin_zona");
  }
  if (vacio(r.sector)) banderas.push("sin_sector");
  if (vacio(r.empleados)) banderas.push("sin_empleados");
  if (vacio(r.ingresos_estimados)) banderas.push("sin_ingresos");
  for (const [re, b] of BANDERAS_NOTA) if (re.test(r.notas ?? "")) banderas.push(b);
  if (r.estado !== r.estado.toLowerCase()) banderas.push("estado_normalizado");
  return {
    id: Number(r.id), razon_social: r.razon_social, nit: r.nit,
    sector: vacio(r.sector) ? null : r.sector, empleados: num(r.empleados),
    ingresos_estimados: num(r.ingresos_estimados), ciudad: r.ciudad, zona,
    fuente: r.fuente, notas: vacio(r.notas) ? null : r.notas, estado: r.estado.toLowerCase(),
    fecha_creacion: r.fecha_creacion, duplicado_de: null as number | null, banderas, datos_originales: r,
  };
});

// duplicados por NIT o por razón social equivalente: el de menor id es el "original"
const grupos = new Map<string, typeof registros>();
for (const r of registros) {
  for (const k of [`nit:${r.nit}`, `rs:${claveEmpresa(r.razon_social)}`]) {
    grupos.set(k, [...(grupos.get(k) ?? []), r]);
  }
}
for (const g of grupos.values()) {
  if (g.length < 2) continue;
  const orden = [...g].sort((a, b) => a.id - b.id);
  for (const r of orden) if (!r.banderas.includes("posible_duplicado")) r.banderas.push("posible_duplicado");
  for (const r of orden.slice(1)) r.duplicado_de ??= orden[0].id;
}
const regIds = new Set(registros.map((r) => r.id));

// ───── Ausencias y actividad ─────
const ausencias = leer("ausencias.csv").map((a) => ({
  id: Number(a.id), usuario_id: Number(a.usuario_id), desde: a.desde,
  hasta: vacio(a.hasta) ? null : a.hasta, motivo: a.motivo,
}));
const actividad = leer("actividad.csv").map((a) => ({
  id: Number(a.id), registro_id: Number(a.registro_id), usuario_id: Number(a.usuario_id), tipo: a.tipo, fecha: a.fecha,
}));

// ───── Integridad referencial ─────
const huerfanos = [
  ...ausencias.filter((a) => !usuarioIds.has(a.usuario_id)).map((a) => `ausencia ${a.id}`),
  ...actividad.filter((a) => !usuarioIds.has(a.usuario_id) || !regIds.has(a.registro_id)).map((a) => `actividad ${a.id}`),
];
if (huerfanos.length) { console.error("Referencias rotas:", huerfanos); process.exit(1); }

// ───── Resumen ─────
const cuenta = (xs: string[][]) => xs.flat().reduce<Record<string, number>>((m, b) => ((m[b] = (m[b] ?? 0) + 1), m), {});
console.log("equipos", equipos.length, "| usuarios", usuarios.length, "| registros", registros.length,
  "| ausencias", ausencias.length, "| actividad", actividad.length);
console.log("banderas usuarios:", cuenta(usuarios.map((u) => u.banderas)));
console.log("banderas registros:", cuenta(registros.map((r) => r.banderas)));
console.log("zonas registros:", cuenta(registros.map((r) => [r.zona ?? "(sin zona)"])));
console.log("duplicados:", registros.filter((r) => r.duplicado_de).map((r) => `${r.id}→${r.duplicado_de}`).join(" "));
if (DRY) process.exit(0);

// ───── Carga ─────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

async function cargar(tabla: string, filas: object[]) {
  const orden = [...filas];
  // Los duplicados apuntan a otro registro: primero originales, luego los duplicados.
  if (tabla === "registros") orden.sort((a, b) => Number((a as { duplicado_de: number | null }).duplicado_de !== null) - Number((b as { duplicado_de: number | null }).duplicado_de !== null));
  for (let i = 0; i < orden.length; i += 100) {
    const { error } = await db.from(tabla).upsert(orden.slice(i, i + 100), { onConflict: "id" });
    if (error) { console.error(`Error cargando ${tabla}:`, error.message); process.exit(1); }
  }
  console.log(`✔ ${tabla}: ${filas.length}`);
}
await cargar("equipos", equipos);
await cargar("usuarios", usuarios);
await cargar("registros", registros);
await cargar("ausencias", ausencias);
await cargar("actividad", actividad);
console.log("Carga completa.");

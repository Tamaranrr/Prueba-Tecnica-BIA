// Crea las claves de ingreso a la consola para los admin y líderes activos.
//   npm run claves                 → solo a quienes aún no tienen clave
//   npm run claves -- --regenerar  → a todos (invalida las anteriores)
// Las claves NO se muestran en pantalla: se escriben en .claves-demo.txt (ignorado por git). En la base solo queda el hash.
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { generarClave, hashClave } from "../src/lib/auth";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const regenerar = process.argv.includes("--regenerar");

const { data, error } = await db.from("usuarios").select("id,nombre,email,rol,activo,clave_hash").in("rol", ["admin", "lider"]).eq("activo", true).order("id");
if (error) {
  console.error(error.message.includes("clave_hash") ? "Falta la columna clave_hash. Ejecuta en Supabase: alter table usuarios add column if not exists clave_hash text;" : error.message);
  process.exit(1);
}
const lineas: string[] = [];
let hechos = 0;
for (const u of data as { id: number; nombre: string; email: string; rol: string; clave_hash: string | null }[]) {
  if (u.clave_hash && !regenerar) continue;
  const clave = generarClave();
  const { error: e } = await db.from("usuarios").update({ clave_hash: await hashClave(clave) }).eq("id", u.id);
  if (e) { console.error(`${u.email}: ${e.message}`); process.exit(1); }
  lineas.push(`${u.rol.padEnd(6)} ${u.email.padEnd(32)} ${clave}   (${u.nombre})`);
  hechos++;
}
if (hechos) {
  writeFileSync(".claves-demo.txt", `Claves de ingreso a la consola (generadas ${new Date().toISOString()}).\nGuárdalas en un gestor de claves y borra este archivo.\n\n${lineas.join("\n")}\n`, { flag: regenerar ? "w" : "a" });
}
console.log(hechos ? `✔ ${hechos} clave(s) creada(s). Están en .claves-demo.txt (no se muestran aquí).` : "Todos los admin y líderes ya tienen clave. Usa --regenerar para cambiarlas.");

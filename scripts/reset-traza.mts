// Borra la traza (asignaciones y ejecuciones) y deja los datos base como vienen de los CSV.
//   npm run reset   → útil antes de grabar la demo
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
for (const t of ["asignaciones", "ejecuciones"] as const) {
  const { error } = await db.from(t).delete().not("id", "is", null);
  if (error) { console.error(t, error.message); process.exit(1); }
  console.log(`✔ ${t} vaciada`);
}
execSync("npm run seed", { stdio: "inherit" }); // restaura el estado original de los registros

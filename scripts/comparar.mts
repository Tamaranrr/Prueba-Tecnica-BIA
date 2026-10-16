// Muestra la comparación de métodos que ve la consola (solo lee de la base).
//   npx tsx --env-file=.env.local scripts/comparar.mts
import { compararMetodos } from "../src/lib/servicio";
const c = await compararMetodos();
console.log(`Fecha ${c.fecha}, ${c.pendientes} pendientes`);
for (const f of c.filas) console.log(f.metodo.padEnd(15), JSON.stringify(f.medicion));

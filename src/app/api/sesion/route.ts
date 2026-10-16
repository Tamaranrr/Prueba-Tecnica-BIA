import { HASH_FALSO, verificarClave } from "@/lib/auth";
import { db, ErrorAuth, ErrorNegocio, ok } from "@/lib/db";
import { cuerpo, responder } from "@/lib/http";
import { cabeceraBorrar, cabeceraSet, requerirSesion, tokenDeSesion } from "@/lib/sesion";

// Quién soy: la consola lo consulta al abrir para decidir si muestra el ingreso.
export const GET = (req: Request) => responder(async () => ({ usuario: await requerirSesion(req) }));

// Ingreso: correo y clave de un admin o líder activo. Responde igual de genérico si falla cualquier cosa.
export async function POST(req: Request) {
  const r = await responder(async () => {
    const b = await cuerpo(req);
    const email = String(b.email ?? "").trim().toLowerCase(), clave = String(b.clave ?? "");
    if (!email || !clave) throw new ErrorNegocio("Escribe tu correo y tu clave.");
    const consulta = await db().from("usuarios").select("id,nombre,email,rol,activo,clave_hash").eq("email", email).maybeSingle();
    if (consulta.error?.message.includes("clave_hash")) throw new ErrorAuth("Falta crear la columna clave_hash en la base (ver supabase/schema.sql).", 503);
    const u = ok(consulta, "ingreso") as unknown as { id: number; nombre: string; email: string; rol: string; activo: boolean; clave_hash: string | null } | null;
    const buena = await verificarClave(clave, u?.clave_hash ?? HASH_FALSO); // siempre se calcula: tarda lo mismo exista o no el correo
    if (!u || !buena || !u.activo || !["admin", "lider"].includes(u.rol)) {
      await new Promise((res) => setTimeout(res, 400)); // frena la fuerza bruta
      throw new ErrorAuth("Correo o clave incorrectos.");
    }
    return { usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, etiqueta: `${u.nombre} (${u.rol} #${u.id})` }, _token: tokenDeSesion(u.id) };
  });
  if (!r.ok) return r;
  const { _token, ...resto } = (await r.json()) as { _token: string; usuario: unknown };
  return Response.json(resto, { headers: { "Set-Cookie": cabeceraSet(_token) } });
}

// Cierre de sesión.
export const DELETE = () => Response.json({ ok: true }, { headers: { "Set-Cookie": cabeceraBorrar() } });

import { COOKIE_SESION, cookieBorrada, cookieSesion, firmarSesion, leerCookie, leerSesion } from "./auth";
import { db, ErrorAuth, ok } from "./db";

export interface SesionUsuario { id: number; nombre: string; rol: "admin" | "lider"; email: string; etiqueta: string }

const produccion = () => process.env.NODE_ENV === "production";

export function secretoSesion(): string {
  const s = process.env.SESSION_SECRET;
  // Sin secreto no se puede firmar ni verificar nada: la consola queda cerrada, nunca abierta.
  if (!s || s.length < 32) throw new ErrorAuth("La consola no está configurada: falta SESSION_SECRET (mínimo 32 caracteres).", 503);
  return s;
}

/** Usuario de la sesión de esta petición. Revalida en la base: un usuario dado de baja pierde el acceso al instante. */
export async function requerirSesion(req: Request): Promise<SesionUsuario> {
  const secreto = secretoSesion();
  const uid = leerSesion(leerCookie(req.headers.get("cookie"), COOKIE_SESION), secreto);
  if (uid === null) throw new ErrorAuth("Inicia sesión para continuar.");
  const u = ok(await db().from("usuarios").select("id,nombre,email,rol,activo").eq("id", uid).maybeSingle(), "sesión") as unknown as
    { id: number; nombre: string; email: string; rol: string; activo: boolean } | null;
  if (!u || !u.activo || !["admin", "lider"].includes(u.rol)) throw new ErrorAuth("Tu usuario ya no tiene acceso a la consola.");
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol as "admin" | "lider", etiqueta: `${u.nombre} (${u.rol} #${u.id})` };
}

export const tokenDeSesion = (uid: number) => firmarSesion(uid, secretoSesion());
export const cabeceraSet = (token: string) => cookieSesion(token, produccion());
export const cabeceraBorrar = () => cookieBorrada(produccion());

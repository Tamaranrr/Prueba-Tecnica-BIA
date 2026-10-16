import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Núcleo de autenticación: funciones puras, sin base de datos, para poder probarlas.
//  - Las claves se guardan con scrypt (nunca en claro).
//  - La sesión es una cookie firmada con HMAC: contiene solo el id del usuario y su vencimiento.

export const COOKIE_SESION = "sesion";
export const DURACION_SESION_S = 8 * 3600;

const scrypt = promisify(scryptCb) as (clave: string, sal: Buffer, largo: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;
const N = 16384, R = 8, P = 1;

export async function hashClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(clave, sal, 32, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64url")}$${h.toString("base64url")}`;
}

/** Compara en tiempo constante. Una clave guardada con formato inválido nunca verifica. */
export async function verificarClave(clave: string, guardada: string | null | undefined): Promise<boolean> {
  const partes = (guardada ?? "").split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, sal, hash] = partes;
  try {
    const esperado = Buffer.from(hash, "base64url");
    const calculado = await scrypt(clave, Buffer.from(sal, "base64url"), esperado.length, { N: Number(n), r: Number(r), p: Number(p) });
    return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}

/** Hash de una clave que nadie conoce: se usa cuando el correo no existe, para que tarde lo mismo que uno válido. */
export const HASH_FALSO = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const firma = (payload: string, secreto: string) => createHmac("sha256", secreto).update(payload).digest("base64url");

export function firmarSesion(usuarioId: number, secreto: string, ahoraMs = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: usuarioId, e: Math.floor(ahoraMs / 1000) + DURACION_SESION_S })).toString("base64url");
  return `${payload}.${firma(payload, secreto)}`;
}

/** Devuelve el id del usuario si el token es auténtico y no venció; si no, null. */
export function leerSesion(token: string | null | undefined, secreto: string, ahoraMs = Date.now()): number | null {
  if (!token || !secreto) return null;
  const [payload, f, resto] = token.split(".");
  if (!payload || !f || resto !== undefined) return null;
  const esperada = Buffer.from(firma(payload, secreto)), recibida = Buffer.from(f);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u: unknown; e: unknown };
    return Number.isInteger(u) && typeof e === "number" && e * 1000 > ahoraMs ? (u as number) : null;
  } catch {
    return null;
  }
}

/** Clave aleatoria legible (sin 0/O ni 1/l/I) para las cuentas de demostración. */
export function generarClave(largo = 14): string {
  const alfabeto = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(largo);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

export function leerCookie(cabecera: string | null, nombre: string): string | null {
  for (const parte of (cabecera ?? "").split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return v.join("=") || null;
  }
  return null;
}

export const cookieSesion = (token: string, produccion: boolean) =>
  `${COOKIE_SESION}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${DURACION_SESION_S}${produccion ? "; Secure" : ""}`;
export const cookieBorrada = (produccion: boolean) =>
  `${COOKIE_SESION}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${produccion ? "; Secure" : ""}`;

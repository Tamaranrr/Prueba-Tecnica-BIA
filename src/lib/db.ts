import { createClient } from "@supabase/supabase-js";

// Solo servidor: usa la secret/service_role key, que ignora RLS. Nunca importar desde un componente de cliente.
let cliente: ReturnType<typeof createClient> | null = null;

export function db() {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  cliente = createClient(url, key, { auth: { persistSession: false } });
  return cliente;
}

/** Error esperado (validación o regla de negocio): la API lo devuelve como 400, no como 500. */
export class ErrorNegocio extends Error {
  constructor(mensaje: string, public detalle?: unknown) { super(mensaje); }
}

/** Falta de sesión o de acceso: la API responde 401 (o 503 si la consola no está configurada). */
export class ErrorAuth extends Error {
  constructor(mensaje: string, public estado: 401 | 503 = 401) { super(mensaje); }
}

export function ok<T>(r: { data: T | null; error: { message: string } | null }, ctx: string): T {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data as T;
}

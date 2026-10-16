"use client";

import { useState } from "react";
import { api } from "@/lib/cliente";
import { boton, campo } from "./ui";

export interface UsuarioSesion { id: number; nombre: string; rol: "admin" | "lider"; email: string; etiqueta: string }

export function Ingreso({ alEntrar, aviso }: { alEntrar: (u: UsuarioSesion) => void; aviso?: string | null }) {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      const r = await api<{ usuario: UsuarioSesion }>("/api/sesion", { email, clave });
      alEntrar(r.usuario);
    } catch (err) { setError((err as Error).message); setClave(""); }
    setEnviando(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" aria-labelledby="titulo-ingreso">
        <h1 id="titulo-ingreso" className="text-lg font-bold text-slate-900">Motor de asignación comercial</h1>
        <p className="mb-5 text-sm text-slate-500">Ingresa con tu cuenta de administrador o líder.</p>
        {aviso && <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>}
        <label className="mb-3 block text-sm text-slate-700">Correo
          <input className={`${campo} mt-1 w-full`} type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="mb-4 block text-sm text-slate-700">Clave
          <input className={`${campo} mt-1 w-full`} type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        <button className={`${boton("primario")} w-full`} disabled={enviando || !email || !clave}>{enviando ? "Verificando…" : "Entrar"}</button>
      </form>
    </main>
  );
}

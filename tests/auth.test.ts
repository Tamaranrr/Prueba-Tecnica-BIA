import { test } from "node:test";
import assert from "node:assert/strict";
import { DURACION_SESION_S, firmarSesion, generarClave, hashClave, leerCookie, leerSesion, verificarClave } from "../src/lib/auth";

const SECRETO = "secreto-de-prueba-con-suficiente-largo-0123456789";

test("clave: la correcta verifica y las demás no; el hash no contiene la clave", async () => {
  const h = await hashClave("Clave-Segura-1");
  assert.ok(!h.includes("Clave-Segura-1"));
  assert.equal(await verificarClave("Clave-Segura-1", h), true);
  assert.equal(await verificarClave("clave-segura-1", h), false);
  assert.equal(await verificarClave("", h), false);
});

test("clave: el mismo texto da hashes distintos (sal) y los formatos inválidos nunca verifican", async () => {
  const a = await hashClave("igual"), b = await hashClave("igual");
  assert.notEqual(a, b);
  assert.equal(await verificarClave("igual", null), false);
  assert.equal(await verificarClave("igual", "texto-cualquiera"), false);
  assert.equal(await verificarClave("igual", "scrypt$1$2$3$4"), false);
});

test("sesión: un token propio se lee; uno alterado, de otro secreto o mal formado no", () => {
  const t = firmarSesion(7, SECRETO);
  assert.equal(leerSesion(t, SECRETO), 7);
  assert.equal(leerSesion(t, "otro-secreto"), null);
  const [payload, firma] = t.split(".");
  const falso = Buffer.from(JSON.stringify({ u: 1, e: 9999999999 })).toString("base64url");
  assert.equal(leerSesion(`${falso}.${firma}`, SECRETO), null); // cambiar el usuario invalida la firma
  assert.equal(leerSesion(`${payload}.${firma}x`, SECRETO), null);
  for (const raro of ["", "abc", "a.b.c", null, undefined]) assert.equal(leerSesion(raro as string, SECRETO), null);
  assert.equal(leerSesion(t, ""), null); // sin secreto no hay sesión válida
});

test("sesión: vence a las 8 horas", () => {
  const t0 = Date.parse("2026-10-16T10:00:00Z");
  const t = firmarSesion(3, SECRETO, t0);
  assert.equal(leerSesion(t, SECRETO, t0 + (DURACION_SESION_S - 5) * 1000), 3);
  assert.equal(leerSesion(t, SECRETO, t0 + (DURACION_SESION_S + 5) * 1000), null);
});

test("cookie: se extrae por nombre aunque haya otras", () => {
  assert.equal(leerCookie("a=1; sesion=abc.def; b=2", "sesion"), "abc.def");
  assert.equal(leerCookie("a=1", "sesion"), null);
  assert.equal(leerCookie(null, "sesion"), null);
});

test("clave generada: largo pedido, sin caracteres ambiguos y distinta cada vez", () => {
  const a = generarClave(), b = generarClave();
  assert.equal(a.length, 14);
  assert.match(a, /^[a-km-zA-HJ-NP-Z2-9]+$/);
  assert.notEqual(a, b);
});

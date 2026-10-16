import type { Datos, RegistroConsola, UsuarioConsola } from "@/lib/cliente";
import { esperaDe } from "./TablaRegistros";
import type { Filtros } from "./TablaRegistros";

/** Cálculos que alimentan el resumen, las alertas y la vista de equipo. Una sola definición para todas las pantallas. */

export type EstadoVendedor = "inactivo" | "ausente" | "sin_capacidad" | "lleno" | "disponible";

export const estadoDe = (u: UsuarioConsola): EstadoVendedor =>
  !u.activo ? "inactivo" : u.ausencia ? "ausente" : !u.capacidad_maxima ? "sin_capacidad" : u.carga >= u.capacidad_maxima ? "lleno" : "disponible";

export const ETIQUETA_ESTADO: Record<EstadoVendedor, { texto: string; tono: "verde" | "ambar" | "rojo" | "gris" }> = {
  disponible: { texto: "disponible", tono: "verde" },
  lleno: { texto: "sin cupo", tono: "ambar" },
  ausente: { texto: "ausente", tono: "ambar" },
  sin_capacidad: { texto: "sin capacidad", tono: "rojo" },
  inactivo: { texto: "inactivo", tono: "rojo" },
};

/** Ocupación = carga ÷ capacidad máxima (lo ocupado, nunca lo libre). null si no hay capacidad definida. */
export const ocupacion = (u: UsuarioConsola) => (u.capacidad_maxima ? u.carga / u.capacidad_maxima : null);
export const cuposLibres = (u: UsuarioConsola) => (u.capacidad_maxima ? Math.max(0, u.capacidad_maxima - u.carga) : 0);
export const vendedores = (d: Datos) => d.usuarios.filter((u) => u.rol === "vendedor");

const ALERTAS_REGISTRO = ["posible_duplicado", "pidio_no_insistir", "base_sin_validar", "sin_zona"];
export const tieneAlerta = (r: RegistroConsola) => r.banderas.some((b) => ALERTAS_REGISTRO.includes(b));

export function resumenDe(d: Datos) {
  const pend = d.registros.filter((r) => r.estado === "nuevo");
  const vend = vendedores(d);
  const activos = vend.filter((u) => u.activo && u.capacidad_maxima);
  const cap = activos.reduce((s, u) => s + (u.capacidad_maxima ?? 0), 0);
  const uso = activos.reduce((s, u) => s + u.carga, 0);
  const elegibles = vend.filter((u) => estadoDe(u) === "disponible");
  const esperas = pend.map((r) => esperaDe(r, d.fecha) ?? 0);
  const ocup = activos.map((u) => ocupacion(u) as number);
  return {
    pendientes: pend.length,
    conEspera: esperas.filter((x) => x >= 7).length,
    masAntiguo: esperas.length ? Math.max(...esperas) : 0,
    ocupacion: cap ? uso / cap : 0,
    cuposLibres: Math.max(0, cap - uso),
    elegibles: elegibles.length,
    totalVendedores: vend.length,
    noDisponibles: vend.length - elegibles.length,
    revision: pend.filter(tieneAlerta).length,
    rangoOcupacion: ocup.length ? { min: Math.min(...ocup), max: Math.max(...ocup) } : { min: 0, max: 0 },
  };
}

export type Destino =
  | { vista: "registros"; filtros: Partial<Filtros> }
  | { vista: "repartir"; usuario?: number }
  | { vista: "equipo" };

export interface Alerta {
  id: string; titulo: string; detalle: string; cantidad: number; tono: "rojo" | "ambar" | "gris";
  accion: { texto: string; destino: Destino };
}

/** Centro de alertas: cada una lleva a una acción concreta, no es un aviso decorativo. */
export function alertasDe(d: Datos): Alerta[] {
  const nuevos = d.registros.filter((r) => r.estado === "nuevo");
  const n = (f: (r: RegistroConsola) => boolean) => nuevos.filter(f).length;
  const vend = vendedores(d);
  const lista: Alerta[] = [];
  const reg = (id: string, titulo: string, detalle: string, cantidad: number, tono: Alerta["tono"], filtros: Partial<Filtros>) =>
    cantidad > 0 && lista.push({ id, titulo, detalle, cantidad, tono, accion: { texto: "Ver registros", destino: { vista: "registros", filtros: { estado: "nuevo", ...filtros } } } });

  reg("duplicados", "Posibles duplicados", "La empresa ya entró por otra fuente. Se retienen y no se reparten.", n((r) => r.banderas.includes("posible_duplicado")), "rojo", { alerta: "posible_duplicado" });
  reg("no_insistir", "Pidieron que no insistieran", "Ya se les contactó y pidieron que no los busquen de nuevo.", n((r) => r.banderas.includes("pidio_no_insistir")), "rojo", { alerta: "pidio_no_insistir" });
  reg("espera", "Esperan 14 días o más", "Llevan demasiado tiempo sin que nadie los tome.", n((r) => (esperaDe(r, d.fecha) ?? 0) >= 14), "ambar", { espera: "14" });
  reg("base", "Base comprada sin validar", "Los datos pueden no ser confiables. Conviene validarlos antes de gastar tiempo.", n((r) => r.banderas.includes("base_sin_validar")), "ambar", { alerta: "base_sin_validar" });
  reg("incompletos", "Datos incompletos", "Falta zona, sector, empleados o ingresos: el reparto es menos preciso.", n((r) => r.banderas.some((b) => ["sin_sector", "sin_empleados", "sin_ingresos", "sin_zona"].includes(b))), "gris", { alerta: "datos_incompletos" });

  const huerfanos = vend.filter((u) => !u.activo && u.carga > 0);
  if (huerfanos.length) {
    const total = huerfanos.reduce((s, u) => s + u.carga, 0);
    lista.push({
      id: "huerfanos", titulo: "Cuentas de vendedores inactivos", cantidad: total, tono: "rojo",
      detalle: `${huerfanos.map((u) => u.nombre).join(", ")} sigue${huerfanos.length > 1 ? "n" : ""} con cuentas en gestión y ya no están activos.`,
      accion: { texto: "Reasignar", destino: { vista: "repartir", usuario: huerfanos.length === 1 ? huerfanos[0].id : undefined } },
    });
  }
  const sinCap = vend.filter((u) => u.activo && !u.capacidad_maxima);
  if (sinCap.length) lista.push({
    id: "sin_capacidad", titulo: "Vendedores sin capacidad", cantidad: sinCap.length, tono: "ambar",
    detalle: `${sinCap.map((u) => u.nombre).join(", ")}: con capacidad vacía o 0 no pueden recibir registros.`,
    accion: { texto: "Ver equipo", destino: { vista: "equipo" } },
  });
  const llenos = vend.filter((u) => u.activo && (ocupacion(u) ?? 0) >= 0.9);
  if (llenos.length) lista.push({
    id: "saturados", titulo: "Vendedores casi llenos", cantidad: llenos.length, tono: "ambar",
    detalle: `${llenos.map((u) => u.nombre).join(", ")} están al 90 % o más de su capacidad.`,
    accion: { texto: "Ver equipo", destino: { vista: "equipo" } },
  });
  return lista;
}

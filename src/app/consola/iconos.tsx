import type { ReactNode } from "react";

/** Una sola familia de iconos lineales (trazo 1.75), heredan el color del texto. */
function Icono({ children, tam = 18 }: { children: ReactNode; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  );
}
type P = { tam?: number };

export const IconoResumen = (p: P) => <Icono {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></Icono>;
export const IconoRepartir = (p: P) => <Icono {...p}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></Icono>;
export const IconoRegistros = (p: P) => <Icono {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Icono>;
export const IconoEquipo = (p: P) => <Icono {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icono>;
export const IconoAuditoria = (p: P) => <Icono {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icono>;
export const IconoAlerta = (p: P) => <Icono {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></Icono>;
export const IconoSalir = (p: P) => <Icono {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Icono>;
export const IconoIA = (p: P) => <Icono {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 3v4M21 5h-4" /></Icono>;
export const IconoCerrar = (p: P) => <Icono {...p}><path d="M18 6 6 18M6 6l12 12" /></Icono>;
export const IconoCheck = (p: P) => <Icono {...p}><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></Icono>;
export const IconoComparar = (p: P) => <Icono {...p}><path d="M3 3v18h18M7 14v4M12 8v10M17 11v7" /></Icono>;
export const IconoFlecha = (p: P) => <Icono {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icono>;
export const IconoMarca = (p: P) => <Icono {...p}><path d="M4 7h11M4 12h16M4 17h8" /><circle cx="19" cy="7" r="2" /></Icono>;

"use client";

import type { Datos } from "@/lib/cliente";
import { TablaRegistros } from "./TablaRegistros";
import { boton, Tarjeta } from "./ui";

export function Registros({ datos, seleccion, setSeleccion, abrir, irARepartir }: {
  datos: Datos; seleccion: Set<number>; setSeleccion: (s: Set<number>) => void; abrir: (id: number) => void; irARepartir: () => void;
}) {
  return (
    <Tarjeta>
      <TablaRegistros datos={datos} base={datos.registros} seleccion={seleccion} setSeleccion={setSeleccion} abrir={abrir} alto="38rem"
        acciones={seleccion.size > 0 ? <button className={boton("primario")} onClick={irARepartir}>Repartir los {seleccion.size} seleccionados</button> : null} />
    </Tarjeta>
  );
}

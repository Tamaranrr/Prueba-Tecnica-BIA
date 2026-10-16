const MS_DIA = 86_400_000;

/** Días enteros entre dos fechas AAAA-MM-DD. */
export const diasEntre = (desde: string, hasta: string) => Math.floor((Date.parse(hasta) - Date.parse(desde)) / MS_DIA);

export const sumaDias = (fecha: string, dias: number) => new Date(Date.parse(fecha) + dias * MS_DIA).toISOString().slice(0, 10);

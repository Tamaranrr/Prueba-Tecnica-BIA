# Guion del video de demo (≈ 6 min)

**Antes de grabar**
- `npm run reset` (deja la traza vacía y los datos como vienen de los CSV).
- Abrir https://prueba-tecnica-bia.vercel.app en una ventana limpia, zoom del navegador al 100 %.
- Tener a mano una pestaña con el repositorio y otra con `supabase/schema.sql`.
- Grabar la pantalla con voz. No hace falta cámara. Ensayar una vez completo.
- Ejecuta como **Diana Marcela Ospina (admin)**, la opción por defecto.

**Idea central que hay que dejar clara:** el motor decide con reglas que se pueden auditar; la IA solo elige entre candidatos que ya pasaron los filtros duros; y todo queda en la traza.

---

## 0:00 a 0:30 · El problema y qué construí
*Mostrar la pantalla inicial.*

> "Un coordinador reparte a mano los registros en un Excel. Resultado: registros que nadie toca durante días, vendedores con 200 cuentas y otros con 12, peleas por las cuentas grandes, y nadie puede explicar por qué la empresa X quedó con Y. Construí tres cosas: un motor de asignación con cuatro métodos, esta consola para operarlo, y una traza en base de datos donde queda todo."

## 0:30 a 1:15 · Datos reales, con sus problemas (pestaña **Equipo**)
> "Los CSV venían sucios y no los limpié a escondidas: los normalicé al cargar y marqué cada cosa con una bandera."

Señalar en pantalla:
- **Nicolás Restrepo** → inactivo, pero con registros en gestión.
- **Laura Bermúdez** → capacidad 0 y recién ingresada. **Andrés Cuéllar** → sin capacidad definida.
- **Valentina Zapata** → incapacidad sin fecha de fin (abierta). Aparece como ausente.
- **Daniela Quintero** → apunta a un equipo que no existe.
> "La carga de cada vendedor no está en ninguna columna: la calculo a partir de la última actividad de cada registro."

## 1:15 a 2:30 · Repartir y previsualizar (pestaña **Repartir**)
1. Alcance: *Registros pendientes (71)*. Método: **Balanceo de carga**. Pulsar **Previsualizar**.
> "Nada se guarda todavía. Veo cuántos se asignan, cuántos quedan retenidos y cómo queda la carga de cada vendedor: lo azul es lo que ya tiene, lo verde lo que recibiría."
2. Mostrar **Retenidos para revisión humana**.
> "Los duplicados y los que pidieron que no insistamos no se asignan: se retienen, con su razón."
3. Abrir una fila de la propuesta.
> "Por cada registro veo a **todos** los candidatos: quién fue descartado y por qué (inactivo, ausente, sin cupo, otra zona) y quién ganó."
4. Cambiar a **Reglas de negocio** y volver a previsualizar. Abrir la **Manufacturas El Dorado** (1.400 empleados): va a un experto corporativo con antigüedad.
5. Abrir **Soluciones Orinoquía** (nota *"alguien senior"*): mostrar que la nota se aplicó como restricción.
> "Las notas de texto libre se aplican de forma determinista. Y esto es lo que ve negocio antes de decidir."

## 2:30 a 3:00 · Ejecutar
Elegir **Balanceo de carga** → **Ejecutar reparto** → confirmar.
> "Ahora sí se escribe: una ejecución con sus parámetros y una asignación por registro."

## 3:00 a 3:50 · Reasignar
1. En **Repartir** → *Reasignar todo lo de un vendedor* → **Nicolás Restrepo** → previsualizar → ejecutar.
> "Nicolás está inactivo y tenía cuentas huérfanas. El motor las reparte entre los demás sin tocar a Nicolás."
2. Pestaña **Registros** → abrir cualquier registro reasignado → **Reasignar manualmente** a Juliana con motivo → *Reasignar*.
3. Intentar reasignar a un inactivo y mostrar el rechazo.
> "El coordinador puede saltarse la zona, pero no los filtros duros: no se puede asignar a alguien inactivo."

## 3:50 a 4:50 · Asignación por IA
1. Método **Asignación por IA**, máximo **3** registros → previsualizar (tarda unos segundos).
> "Claude lee el registro completo, incluidas las notas, y elige. Pero **no puede elegir a cualquiera**: los filtros duros corren antes y solo recibe candidatos válidos. Además valido su respuesta; si falla, caigo a balanceo de carga y queda marcado como respaldo. Nunca se deja un registro colgado."
2. Abrir una fila y desplegar **Ver prompt completo enviado al modelo**.
> "Negocio pidió poder auditar exactamente qué se le mandó al modelo. Este es el prompt completo, con los datos del registro, y esta la respuesta cruda."
3. Ejecutar.
> "Lo que se ejecuta es **lo que previsualicé**, no una consulta nueva: el modelo no es determinista y no quiero que cambie entre ver y ejecutar."

## 4:50 a 5:40 · ¿Por qué este registro terminó acá? (detalle + Auditoría)
1. Abrir un registro asignado por IA.
> "Aquí está la respuesta: quién lo tiene, con qué método, quién lo ejecutó, cuándo, el motivo y los candidatos evaluados."
2. Abrir uno reasignado: mostrar la cadena **vigente / reemplazada**.
> "Nunca se sobrescribe: cada reasignación crea una fila nueva y marca la anterior."
3. Abrir un registro de la operación anterior (estado *en gestión*, sin asignaciones).
> "Si no pasó por el motor, lo dice y explica por qué: es de quien hizo la última acción."
4. Pestaña **Auditoría**: abrir una ejecución y mostrar los **parámetros exactos**.

## 5:40 a 6:10 · Cierre
> "Tres decisiones que quiero destacar: **filtros duros antes de cualquier método**, para que la IA no pueda romper reglas; **datos sucios marcados, no escondidos**; y **traza inmutable**, con el prompt completo. Lo que dejé fuera a propósito: autenticación (la consola es pública para la demo), y el método de IA procesa un máximo por corrida porque consulta al modelo registro por registro. Con más tiempo: login por rol, cola de reintentos y evaluar la IA contra el balanceo con métricas."

---

## Si algo falla en directo
- La IA tarda → seguir hablando de los filtros duros; no pasar de 3 registros.
- Error de la IA → es parte de la demo: mostrar que cae a respaldo y queda marcado.
- Para repetir la grabación: `npm run reset`.

## Qué mostrar en pantalla sin que se lea mal
- No abrir `.env.local` ni el panel de variables de Vercel o Supabase.
- Datos de empresas y nombres son del ZIP de prueba (ficticios).

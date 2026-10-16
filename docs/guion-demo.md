# Guion del video de demo (aprox. 7 min)

**Antes de grabar**
- `npm run reset` (deja la traza vacía y los datos como vienen de los CSV). La caché de notas no se borra: así la primera previsualización no tarda.
- Abrir https://prueba-tecnica-bia.vercel.app en una ventana limpia, zoom del navegador al 100 %.
- Entrar con la cuenta de **Diana Marcela Ospina (admin)** (la clave está en `.claves-demo.txt`; no la muestres en pantalla: deja la sesión ya iniciada antes de grabar).
- Tener a mano una pestaña con el repositorio. Grabar la pantalla con voz, sin cámara. Ensayar una vez completo.

**Idea central que hay que dejar clara:** el motor decide con reglas que se pueden auditar; la IA solo elige entre candidatos que ya pasaron los filtros duros y que ve la cartera de cada uno; y todo queda en la traza.

---

## 0:00 a 0:30 · El problema y qué construí
*Mostrar la pantalla inicial.*

> "Un coordinador reparte a mano los registros en un Excel. Resultado: registros que nadie toca durante días, vendedores con 200 cuentas y otros con 12, peleas por las cuentas grandes, y nadie puede explicar por qué la empresa X quedó con Y. Construí tres cosas: un motor de asignación con cuatro métodos, esta consola para operarlo, y una traza en base de datos donde queda todo."

*Opcional, 20 segundos: abrir **Resumen** y mostrar las alertas de calidad (duplicados, "no insistir", sin vendedor válido) y que cada una lleva a una acción.*

## 0:30 a 1:30 · Lo que ya tiene cada vendedor (pestaña **Equipo**)
> "Antes de repartir hay que saber qué tiene cada uno. Los datos venían sucios y no los limpié a escondidas: los normalicé al cargar y marqué cada cosa. Y calculo la cartera de cada vendedor a partir de la actividad."

Señalar en pantalla:
- **Fecha de operación** arriba: 27 de septiembre, la de los datos. *"Uso el hoy de los datos, no el reloj: con la fecha de hoy casi todas las ausencias ya habrían terminado."*
- **Nivel y cartera** de cada vendedor: cuántas cuentas, de qué segmento, cuánto suman en ingresos, acciones de los últimos 14 días y cuentas frías.
- **Julián Camargo** ausente por vacaciones; **Andrés Cuéllar** *"se ausenta el 28"* y no tiene capacidad definida; **Valentina Zapata** con incapacidad abierta; **Nicolás Restrepo** inactivo.
- **Laura Bermúdez**: recién entrada (rampa) con capacidad provisional de 10. *"Solo recibe cuentas pyme, para nivelarse."*

*Antes de repartir, 30 segundos en **Comparar métodos**: los mismos 71 pendientes con round-robin, balanceo y reglas. Señalar que los métodos simples ignoran la especialidad (26 % y 30 % con experto de su segmento) y que ninguno rompe una regla dura.*

## 1:30 a 3:00 · Repartir y previsualizar (pestaña **Repartir**)
1. Alcance: *Todos los pendientes (71)*. Método: **Reglas de negocio**. Pulsar **Previsualizar**.
> "Nada se guarda todavía. Veo cuántos se asignan, cuántos quedan retenidos y cómo queda la carga de cada vendedor."
2. Señalar el orden: *"se reparte corporativo, luego industrial, luego pyme: las cuentas grandes eligen primero."*
3. Abrir una cuenta corporativa. Mostrar la tabla de candidatos.
> "Por cada registro veo a todos los candidatos con su nivel y la cartera que tenían al decidir: quién fue descartado y por qué (ausente, se ausenta pronto, en rampa, sin cupo...) y quién ganó."
4. Abrir **Manufacturas El Dorado** (1.400 empleados): cuenta corporativa a un experto con antigüedad. Abrir **Soluciones Orinoquía** (nota *"alguien senior"*) y mostrar que la nota se aplicó.
5. Mostrar **Retenidos para revisión humana**.
> "Los duplicados y quienes pidieron que no insistamos no se asignan: se retienen, con su razón."

## 3:00 a 3:30 · Ejecutar
Elegir **Balanceo de carga**, ejecutar y confirmar. Ir a **Registros** y filtrar por estado.
> "Ahora sí se escribe. Lo que reparte el motor queda en estado **autoasignado**, en azul, para distinguirlo de lo que ya venía asignado por una persona."

## 3:30 a 4:15 · Reasignar y cuentas frías
1. En **Repartir** elegir *Reasignar todo lo de un vendedor*, **Nicolás Restrepo**, previsualizar y ejecutar.
> "Nicolás está inactivo y tenía cuentas huérfanas. El motor las reparte entre los demás, y nadie puede recibir una cuenta que ya es suya."
2. Mostrar la opción **Cuentas frías**: cuentas con dueño pero sin movimiento hace 30 días o más.
3. En **Registros**, abrir un registro y reasignarlo a mano a otro vendedor con motivo. Intentar con uno inactivo y mostrar el rechazo.
> "El coordinador puede saltarse la zona, pero no los filtros duros."

## 4:15 a 5:15 · Asignación por IA
1. Método **Asignación por IA**, máximo **3** registros, previsualizar (tarda unos segundos).
> "Claude no puede elegir a cualquiera: los filtros duros corren antes. Y recibe la cartera de cada candidato: cuántas cuentas grandes tiene, cuánto suma en ingresos, qué tan activo está. Valido su respuesta; si falla, caigo a balanceo de carga y queda marcado."
2. Abrir una fila y desplegar **Ver prompt completo enviado al modelo**.
> "Negocio pidió poder auditar exactamente qué se le mandó al modelo. Este es el prompt completo, con los datos del registro y la cartera de cada candidato, y esta la respuesta cruda."
3. Ejecutar.
> "Lo que se ejecuta es lo que previsualicé, no una consulta nueva: el modelo no es determinista."

## 5:15 a 6:15 · ¿Por qué este registro terminó acá? (detalle y Auditoría)
1. Abrir un registro asignado por IA.
> "Aquí está la respuesta: quién lo tiene, con qué método, quién lo ejecutó, cuándo, el motivo y la cartera de los candidatos al momento de decidir."
2. Abrir uno reasignado: mostrar la cadena **vigente / reemplazada**.
> "Nunca se sobrescribe: cada reasignación crea una fila nueva y marca la anterior."
3. Abrir un registro de la operación anterior (estado *en gestión*, sin asignaciones).
> "Si no pasó por el motor, lo dice y explica por qué: es de quien hizo la última acción."
4. Pestaña **Auditoría**: abrir una ejecución y mostrar qué asignó y los **parámetros exactos**.

## 6:15 a 7:00 · Cierre
> "Cuatro decisiones que quiero destacar: **filtros duros antes de cualquier método**, comprobados con un cálculo independiente sobre los datos reales (cero violaciones); **cartera y antigüedad por niveles**, para cuidar a los nuevos y no concentrar las cuentas grandes; **datos sucios marcados, no escondidos**; y **traza inmutable**, con el prompt completo. Lo que no está resuelto: los umbrales, los niveles y los pesos son supuestos medidos en estos datos, que negocio debe validar; la IA iguala a las reglas más que superarlas, y su valor está en leer las notas y explicar cada decisión; y el método de IA procesa un máximo por corrida porque consulta al modelo registro por registro."

---

## Si algo falla en directo
- La IA tarda: seguir hablando de los filtros duros; no pasar de 3 registros.
- Error de la IA: es parte de la demo, mostrar que cae a respaldo y queda marcado.
- Para repetir la grabación: `npm run reset`.

## Qué mostrar en pantalla sin que se lea mal
- No abrir `.env.local`, `.claves-demo.txt` ni el panel de variables de Vercel o Supabase.
- Los nombres y las empresas son del ZIP de prueba (ficticios).

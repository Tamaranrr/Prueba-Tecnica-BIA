# Guion del video de demo (aprox. 8 min)

Está escrito para leerlo en voz alta, tal cual, mientras se muestra la pantalla. Lo que va entre *cursivas* es lo que hay que hacer o señalar; lo que va entre comillas es lo que se dice.

## Antes de grabar
- `npm run reset`: deja la traza vacía y los datos como vienen de los CSV. La caché de notas no se borra, así la primera previsualización no tarda.
- Abrir https://prueba-tecnica-bia.vercel.app en una ventana limpia, zoom al 100 %, y **verificar la "Versión" abajo en la barra lateral** (debe ser la del último commit; si no, Ctrl+F5).
- Entrar con la cuenta de **Diana Marcela Ospina (admin)**. La clave está en `.claves-demo.txt`: no la muestres. Deja la sesión iniciada antes de grabar.
- Tener a mano una pestaña con el repositorio. Grabar pantalla con voz, sin cámara. Ensayar una vez completo.

## La idea que hay que dejar clara
Tres frases, dichas con calma al principio y al final:
1. **El motor decide con reglas que se pueden auditar.** Los filtros duros corren antes que cualquier método.
2. **La IA solo elige entre candidatos que ya pasaron esos filtros**, ve la cartera de cada uno, y su respuesta se valida.
3. **Todo queda en una traza que no se sobrescribe**, con el prompt completo.

---

## 0:00 a 0:45 · El problema y qué construí
*Pantalla: pestaña **Resumen**.*

> "Un coordinador comercial reparte a mano los registros nuevos en un Excel. El resultado es conocido: empresas que nadie toca durante días, vendedores con muchas cuentas y otros con pocas, peleas por las cuentas grandes, y nadie puede explicar por qué la empresa X terminó con el vendedor Y.
>
> Construí tres cosas: un motor de asignación con cuatro métodos, esta consola para operarlo, y una traza en base de datos donde queda todo. Voy a recorrer la consola como lo haría un coordinador."

*Señalar los cuatro indicadores:* 71 pendientes, el más antiguo lleva 23 días, 9 de 13 vendedores disponibles, ocupación del equipo.

> "Aquí abajo, el centro de alertas: lo que no se debe repartir a ciegas. Posibles duplicados, gente que pidió que no insistamos, cuentas que esperan dos semanas o más. Cada alerta lleva a una acción."

*Señalar la fecha de operación abajo a la izquierda (27 de septiembre).*

> "Un detalle: uso como 'hoy' la fecha del último movimiento de los datos, no el reloj. Con la fecha real, casi todas las ausencias ya habrían terminado y parecería que no se miran."

## 0:45 a 1:45 · Quiénes son los vendedores (**Equipo comercial**)
> "Antes de repartir hay que saber qué tiene cada uno. Los datos venían sucios y no los limpié a escondidas: los normalicé al cargar y dejé una bandera por cada cambio. Y calculo la cartera de cada vendedor a partir de la actividad."

*Mostrar tres o cuatro fichas:*
- Una ficha normal: *"nivel por antigüedad, carga sobre capacidad, y la mezcla de su cartera: cuántas cuentas corporativas, industriales y pyme."*
- **Julián Camargo**: ausente por vacaciones. **Andrés Cuéllar**: "se ausenta el 28" y sin capacidad definida. **Nicolás Restrepo**: inactivo.
- **Laura Bermúdez**: recién entrada (rampa) con capacidad provisional de 10. *"Solo recibe cuentas pyme, para que se nivele."*

*Usar el filtro "Requieren atención".*

> "Todo esto no es decoración: son los filtros que el motor aplica antes de decidir."

## 1:45 a 2:45 · Por qué hay cuatro métodos (**Comparar métodos**)
> "Aquí repartí los mismos 71 pendientes con tres métodos y comparé el resultado, sin guardar nada."

*Señalar las filas, de arriba abajo:*
- "Round-robin y balanceo reparten parejo, pero ignoran la especialidad: solo el 26 % y el 30 % de las cuentas llegan a un experto de su segmento."
- "Las reglas suben eso al 69 %, y las cuentas grandes llegan a un experto corporativo 11 de 16 veces."
- *Fila "Reglas duras rotas":* "Cero en todos. Ninguno puede asignar a un ausente, a un inactivo, ni una cuenta grande a alguien con menos de dos años."

> "Un método simple no es malo: es una línea de base. Lo que cambia es qué se optimiza. El motor deja elegir y mostrar la diferencia con números."

## 2:45 a 4:30 · Repartir y previsualizar (**Repartir**)
*Alcance: todos los pendientes. Método: **Reglas de negocio**. Pulsar **Previsualizar reparto**.*

> "Nada se guarda todavía. Primero veo el resumen: cuántos se asignan, cuántos quedan retenidos y cuántos no tienen vendedor válido. Después, cómo queda la carga de quienes reciben."

*Señalar el orden: abrir la primera empresa de la lista.*

> "Se reparte primero lo corporativo, luego lo industrial y al final lo pyme. Es un orden por ingresos: las cuentas grandes eligen primero."

*Abrir una empresa y leer "Por qué va con…".*

> "Cada asignación trae su porqué en lenguaje simple: quién es, por qué le toca esta cuenta. Y si quiero profundizar, puedo ver quiénes más podían recibirla y quiénes no podían y por qué: ausente, en rampa, sin cupo, con menos de dos años."

*Abrir **Soluciones Orinoquía** (nota "alguien senior") y mostrar la línea "Lo que se leyó en la nota".*

> "Las notas en texto libre las lee una IA y las traduce a señales: urgencia, perfil senior, necesidad industrial. El motor aplica esas señales como reglas, y cada nota se lee una sola vez y queda guardada."

*Bajar a **Retenidos para revisión humana**.*

> "Los duplicados y quienes pidieron que no insistamos no se asignan: se retienen, con su razón. Prefiero que una persona decida a que el sistema adivine."

## 4:30 a 5:00 · Ejecutar
*Cambiar a **Balanceo de carga** (o dejar reglas), pulsar **Ejecutar reparto** y confirmar. Ir a **Registros**.*

> "Ahora sí se escribe. Lo que reparte el motor queda en estado autoasignado, en azul, para distinguirlo de lo que ya venía asignado por una persona. Y ahora esta vista dice a quién se le asignó cada empresa, quién lo hizo, cuándo, con qué método y por qué."

*Usar "Ver solo estos" en el aviso del último reparto.*

## 5:00 a 5:45 · Reasignar
*En **Repartir**: "Reasignar todo lo de un vendedor" → **Nicolás Restrepo** → previsualizar → ejecutar.*

> "Nicolás está inactivo y tiene cuentas huérfanas. El motor las reparte entre los demás, y nadie puede recibir una cuenta que ya es suya."

*Mostrar la opción "Cuentas frías" (cuentas con dueño sin movimiento hace 30 días o más).*

*En **Registros**, abrir un registro y reasignarlo a mano con un motivo. Intentarlo con un vendedor inactivo.*

> "El coordinador puede saltarse la zona, pero no los filtros duros: el sistema lo rechaza."

## 5:45 a 6:45 · Asignación por IA
*Método **Asignación por IA**. Primero, **Previsualizar reparto** con 3 registros (tarda unos segundos).*

> "Claude no puede elegir a cualquiera: los filtros duros corren antes, así que la lista que recibe ya es válida. Además ve la cartera de cada candidato: cuántas cuentas grandes tiene, cuánto suma en ingresos y qué tan activo está. Valido su respuesta contra la lista. Si falla, cae a balanceo de carga y el registro queda marcado, nunca queda colgado."

*Ejecutar esa previsualización.*

> "Lo que se ejecuta es exactamente lo que previsualicé, no una consulta nueva: el modelo no es determinista."

*Después, mostrar **Repartir todo con IA** (sin ejecutarlo, o ejecutándolo si hay tiempo).*

> "Para repartir todo de una vez, este botón consulta al modelo de 6 en 6, por prioridad, y revalida cada decisión con el estado actual. Con 61 registros tarda cerca de un minuto, cuesta unos cuatro centavos de dólar y no rompió ninguna regla en la medición."

*Mostrar la barra de progreso unos segundos.*

## 6:45 a 7:45 · ¿Por qué este registro terminó acá? (**Registros** y **Auditoría**)
*Abrir un registro asignado por IA.*

> "Esta es la pregunta central de la prueba. Aquí está la respuesta: quién lo tiene, con qué método, quién lo ejecutó, cuándo, el motivo, y la cartera de todos los candidatos al momento de decidir."

*Desplegar el prompt en la cadena de asignaciones.*

> "Negocio pidió poder auditar exactamente lo que se le mandó al modelo. Este es el prompt completo, con los datos del registro, y esta es la respuesta cruda. No hace falta para operar, pero queda guardado para auditar."

*Abrir uno reasignado: mostrar la cadena vigente / reemplazada.*

> "Nunca se sobrescribe. Cada reasignación crea una fila nueva y marca la anterior como no vigente."

*Abrir un registro que ya venía asignado de antes (sin asignaciones del motor).*

> "Si no pasó por el motor, lo dice: es de quien hizo la última acción."

*Pestaña **Historial y auditoría**: abrir una ejecución.*

> "Y aquí cada ejecución, con los parámetros exactos con los que se hizo. Con eso se puede reproducir."

## 7:45 a 8:30 · Cierre
> "Cuatro decisiones que quiero destacar:
> Uno: **filtros duros antes de cualquier método**, comprobados con un cálculo independiente sobre los datos reales. Cero violaciones.
> Dos: **cartera y antigüedad por niveles**, para cuidar a los vendedores nuevos y no concentrar las cuentas grandes.
> Tres: **datos sucios marcados, no escondidos**, y retener en vez de adivinar.
> Cuatro: **traza inmutable**, con el prompt completo.
>
> Lo que no está resuelto, y lo digo con honestidad: los umbrales, los niveles y los pesos son supuestos medidos en estos datos que negocio debe validar. La IA iguala a las reglas más que superarlas: su valor está en leer las notas y en explicar cada decisión. Y el ingreso es sencillo a propósito: en producción lo natural sería el acceso de la empresa. Gracias."

---

## Si algo falla en directo
- La IA tarda: seguir hablando de los filtros duros; en la previsualización no pasar de 3 registros.
- Error de la IA: es parte de la demo; mostrar que cae a respaldo y queda marcado `ia_respaldo`.
- Se ve algo viejo en pantalla: Ctrl+F5 y revisar la "Versión" de la barra lateral.
- Para repetir la grabación: `npm run reset`.

## Qué no mostrar en pantalla
- `.env.local`, `.claves-demo.txt`, ni el panel de variables de Vercel o Supabase.
- Los nombres y las empresas son del ZIP de prueba (ficticios).

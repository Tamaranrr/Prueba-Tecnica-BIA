# Motor de asignación comercial

Prueba técnica BIA · AI Engineer · **Opción A**.

Reparte los registros nuevos entre los vendedores con cuatro métodos (tres deterministas y uno con IA), una consola para operarlo y una traza completa en base de datos que responde a la pregunta *"¿por qué la empresa X terminó con el vendedor Y?"*.

| | |
|---|---|
| **Demo desplegada** | https://prueba-tecnica-bia.vercel.app |
| **Video** | _(enlace)_ |
| **Guion del video** | [docs/guion-demo.md](docs/guion-demo.md) |

> La consola **no tiene login** (el reto no lo pide). Cualquiera con la URL puede ejecutar asignaciones y el método de IA consume saldo de API. Ver [Limitaciones](#limitaciones-conocidas).

---

## Qué hace

1. **Motor** con cuatro métodos, todos con la misma interfaz y los mismos filtros duros previos:
   - **Round-robin ponderado**: rota entre los vendedores elegibles; quien tiene más cupo libre recibe más turnos.
   - **Balanceo de carga**: cada registro va al menos ocupado (`carga ÷ capacidad`). Nivela a los nuevos con los antiguos.
   - **Reglas de negocio**: puntúa segmento experto, zona, carga y antigüedad (pesos configurables). Las cuentas corporativas no van a vendedores con menos de N días y las notas *"alguien senior"* / *"que conozca el sector"* se aplican como restricción.
   - **IA** (Claude): lee el registro completo, notas incluidas, y elige entre los candidatos que ya pasaron los filtros.
2. **Consola** (`/`): ver pendientes, elegir y configurar el método, **previsualizar** sin guardar, ejecutar, reasignar (todo lo de un vendedor o un registro suelto) y abrir un registro para ver por qué quedó donde está.
3. **Traza**: cada asignación guarda registro, usuario, método, parámetros, quién la ejecutó, cuándo, si reemplazó a otra, el motivo, el puntaje de **todos** los candidatos evaluados y, en el método IA, el **prompt completo con los datos del registro**, la respuesta cruda y el modelo.

## Decisiones de diseño

- **Filtros duros antes de cualquier método.** Un vendedor inactivo, ausente en la fecha, con capacidad 0 o sin definir, sin cupo, que aún no ingresa, líder/admin (salvo que se pida) o de otra zona (en modo estricto) **nunca llega a un método ni al modelo**. Así la IA no puede romper reglas, y esto está cubierto con pruebas para los tres métodos.
- **Motor puro.** `src/lib/engine` recibe datos y devuelve propuestas; no toca la base. Por eso previsualizar y ejecutar usan exactamente el mismo cálculo.
- **La IA propone, el código dispone.** El modelo solo ve candidatos válidos. Su respuesta se valida contra la lista y contra un esquema; si falla (formato, rechazo, vendedor fuera de lista, error de red) el registro se asigna por balanceo de carga y queda marcado `ia_respaldo`. Nunca se deja un registro colgado. Los fallos de cuenta (sin saldo, key inválida) abortan en vez de repartir en silencio.
- **Se ejecuta lo previsualizado.** El modelo no es determinista: la previsualización de IA se guarda (con su prompt y respuesta) y *Ejecutar* aplica esa, no hace una consulta nueva. Se revalida que nada haya cambiado y caduca en 1 hora.
- **Traza inmutable.** Reasignar nunca sobrescribe: crea una fila nueva con `reemplaza_a` y marca la anterior como no vigente. Un índice único parcial garantiza una sola asignación vigente por registro.
- **Datos sucios marcados, no escondidos.** Se normaliza al cargar y cada cambio queda como bandera (`zona_normalizada`, `zona_inferida_por_ciudad`, `sin_capacidad`, `equipo_inexistente:99`…), junto con la fila original en `datos_originales`.
- **Retener en vez de adivinar.** Los duplicados y los registros que pidieron *"que no insistiéramos"* no se asignan: aparecen como **retenidos para revisión humana**, con su razón.
- **Reproducible.** Cada ejecución guarda la *fecha de referencia* usada para ausencias y antigüedad.
- **Seguridad.** Todo el acceso a Supabase es desde el servidor con la secret key; las tablas tienen RLS activo y sin políticas, así que la key pública no lee nada. Solo un admin o líder activo puede ejecutar.

## Supuestos (revisables)

| Tema | Decisión |
|---|---|
| **Carga de un vendedor** | No hay columna de dueño en `registros`. Se calcula así: registros en `asignado`/`en_gestion` cuyo **último movimiento en `actividad`** es del vendedor; una asignación vigente del motor manda sobre la actividad histórica. |
| **Zona Bogotá** | No es zona de ningún equipo → se trata como **Centro**. |
| **Zona vacía** | Se infiere por la ciudad (zona más frecuente entre registros de esa ciudad) y se marca `zona_inferida_por_ciudad`. |
| **Segmento de la cuenta** | Corporativo si ≥ 500 empleados o ≥ 30.000 M COP de ingresos; industrial si el sector es fabril/agro/construcción; el resto, pyme. Umbrales en `src/lib/engine/segmento.ts`. |
| **Duplicados** | Mismo NIT, o misma razón social ignorando mayúsculas y puntuación. **No** se ignora el sufijo societario: "X S.A.S." y "X Ltda." son empresas distintas. El de menor id es el original. |
| **Capacidad vacía o 0** | No puede recibir. Se muestra como bandera en la consola. |
| **Usuario sin zona / equipo inexistente** | Hereda la zona del equipo si la tiene; el equipo 99 inexistente se anula con bandera. |
| **Líderes** | No reciben por defecto (opción en la consola). |
| **Ausencia sin fecha de fin** | Se considera abierta (sigue ausente). |
| **Quien sale** | Un vendedor inactivo conserva sus cuentas hasta que se reasignan; no recibe nuevas. |

## Cómo correrlo

Requisitos: Node 20+, un proyecto de Supabase y una API key de Anthropic.

```bash
npm install
cp .env.example .env.local   # completar los valores
```

`.env.local`:

```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co   # sin /rest/v1/
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=                            # solo servidor
# ANTHROPIC_MODEL=claude-opus-5-5                     # opcional
```

1. En Supabase → **SQL Editor**, ejecutar [supabase/schema.sql](supabase/schema.sql) (crea las tablas; borra las existentes).
2. Cargar los datos: `npm run seed` (los CSV están en `data/`). `npm run seed:dry` muestra el resumen de normalización sin tocar la base.
3. `npm run dev` → http://localhost:3000

| Script | Qué hace |
|---|---|
| `npm test` | 19 pruebas del motor (filtros duros, carga, métodos, zona, retención) |
| `npm run seed` / `seed:dry` | Carga los CSV normalizados / solo muestra el resumen |
| `npm run reset` | Vacía la traza y restaura los datos (útil antes de grabar la demo) |
| `npx tsx --env-file=.env.local scripts/probar-ia.mts 3` | Prueba el método de IA sin escribir en la traza |

**Despliegue:** Vercel con las 4 variables de entorno. No usar la integración de Supabase de Vercel (crea otra base).

## API

Todas devuelven JSON; los errores de negocio responden 400 con un mensaje legible.

| Ruta | Para qué |
|---|---|
| `GET /api/datos?fecha=` | Registros, equipo, carga y ausencias para la consola |
| `POST /api/preview` | Simula un reparto sin guardar. Método `ia` guarda la previsualización y devuelve `preview_id` |
| `POST /api/ejecutar` | Ejecuta y escribe la traza. Requiere `ejecutado_por` (admin o líder activo). Con IA, requiere `preview_id` |
| `POST /api/reasignar` | Reasignación manual de un registro, con motivo obligatorio |
| `GET /api/registros/:id` | Datos, actividad y cadena completa de asignaciones |
| `GET /api/ejecuciones` | Historial de ejecuciones |

## Estructura

```
src/lib/engine/   motor puro: tipos, filtros duros, carga, segmento, métodos, orquestación
src/lib/ia.ts     prompt, llamada a Claude con salida estructurada, validación y respaldo
src/lib/servicio.ts  lote, previsualizar, ejecutar, reasignar y escritura de la traza
src/app/api/      rutas
src/app/consola/  interfaz
supabase/schema.sql   esquema · scripts/  carga y reset · tests/  pruebas · data/  CSV
```

## Limitaciones conocidas

- **Sin autenticación.** `ejecutado_por` lo elige quien usa la consola. Lo siguiente sería login por rol.
- **La IA es secuencial y con tope por corrida** (10 por defecto, 40 máximo): cada decisión cambia la carga de la siguiente y el plan gratuito de Vercel corta a los 60 s. Para volúmenes grandes habría que mover la IA a una cola.
- **Sin transacciones reales**: `supabase-js` no las ofrece. Si falla a mitad de una ejecución se revierte lo escrito, pero una función SQL (RPC) sería más robusta.
- **Los umbrales de segmento y los pesos de las reglas son una propuesta**, no están validados con negocio.
- **No se evaluó la calidad de la IA contra los métodos deterministas** con métricas; es el siguiente paso natural.
- **Datos personales en el prompt**: se guarda el prompt completo porque negocio lo pidió; en producción habría que fijar retención y control de acceso a esa tabla.

---

## Uso de IA en el desarrollo

Trabajé con Claude Code como entorno principal, con este método: **primero el plan y recién después el código**, una decisión mía por cada ambigüedad de los datos, y verificación de cada paso (pruebas, llamadas reales a la API y recorrido de la consola en el navegador) antes de avanzar. La IA propuso; yo decidí, cuestioné y fijé el orden.

Estos son mis mensajes, **tal cual** los escribí, en los momentos donde mi decisión cambió el rumbo:

| Momento | Mi mensaje | Qué cambió en el proyecto |
|---|---|---|
| Antes de escribir una línea | *"vamos primero a mapear que es lo que vamos a hacer , como lo vamos a  hacer y como funcionara. Despues de tener un plan hecho miramos si codificamos"* | Se analizaron los CSV antes de diseñar. Ahí apareció que no existía una columna de dueño del registro, así que la carga se calcula desde la actividad. |
| Datos sucios | *"(Me gusta hazlo asi)"* sobre normalizar al cargar y marcar con banderas en lugar de borrar | Nada se descarta en silencio: cada ajuste queda como bandera y la fila original se conserva. |
| Zona Bogotá | *"(Si, seria lo logico)"* | Bogotá se trata como Centro y queda documentado en Supuestos. |
| No aceptar lo que no entiendo | *"¿Qué cuenta como carga de un vendedor? ... (Explicame bien esto )"* | Pedí la explicación con datos reales antes de aprobar la definición de carga, que es la base de los tres métodos. |
| Cuestionar una dependencia | *"Es necesaria una api key de claude?"* | Quedó claro que solo el método de IA la necesita; el resto del motor funciona sin ella. |
| Corregir un paso de la integración | *"Igualmente hice la integracion con supabase en optional integrations, le doy a deploy?"* | La integración habría creado una base de datos nueva y vacía; se quitó antes de desplegar. |
| Prioridades | *"Primero configuremos Git y subamos al repositorio."* · *"Primero hagamos la consola web."* · *"Primero desplegamos en Vercel; guíame."* | Orden de trabajo: código versionado desde temprano, consola antes del método de IA, y despliegue verificado antes de redactar la documentación. |

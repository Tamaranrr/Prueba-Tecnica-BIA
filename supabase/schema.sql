-- Esquema del motor de asignación comercial (Prueba técnica BIA).
-- Pegar completo en Supabase → SQL Editor → Run. Es idempotente: se puede volver a correr.
-- OJO: borra y recrea las tablas (incluida la traza). Úselo solo al inicio.

drop table if exists asignaciones cascade;
drop table if exists ejecuciones cascade;
drop table if exists actividad cascade;
drop table if exists ausencias cascade;
drop table if exists registros cascade;
drop table if exists usuarios cascade;
drop table if exists equipos cascade;

-- ───────────── Datos base (cargados desde los CSV, ya normalizados) ─────────────

create table equipos (
  id        int primary key,
  nombre    text not null,
  lider_id  int,                       -- sin FK: Costa no tiene líder y evita ciclo con usuarios
  zona      text not null
);

create table usuarios (
  id                int primary key,
  nombre            text not null,
  email             text not null,
  rol               text not null check (rol in ('admin','lider','vendedor')),
  equipo_id         int references equipos(id),
  zona              text,
  segmento_experto  text check (segmento_experto in ('corporativo','pyme','industrial')),
  capacidad_maxima  int,               -- null = no definida (bandera sin_capacidad)
  fecha_ingreso     date,
  activo            boolean not null,
  banderas          text[] not null default '{}',   -- problemas de calidad detectados al cargar
  datos_originales  jsonb not null                  -- fila tal cual venía en el CSV
);

create table registros (
  id                 int primary key,
  razon_social       text not null,
  nit                text not null,
  sector             text,
  empleados          int,
  ingresos_estimados bigint,
  ciudad             text not null,
  zona               text,
  fuente             text not null,
  notas              text,
  estado             text not null check (estado in ('nuevo','asignado','en_gestion','descartado')),
  fecha_creacion     date not null,
  duplicado_de       int references registros(id),  -- id del registro "original" si es duplicado
  banderas           text[] not null default '{}',
  datos_originales   jsonb not null
);
create index registros_estado_idx on registros(estado);

create table ausencias (
  id          int primary key,
  usuario_id  int not null references usuarios(id),
  desde       date not null,
  hasta       date,                    -- null = abierta (sin fecha de fin)
  motivo      text not null
);

create table actividad (
  id           int primary key,
  registro_id  int not null references registros(id),
  usuario_id   int not null references usuarios(id),
  tipo         text not null,
  fecha        date not null
);
create index actividad_registro_idx on actividad(registro_id);

-- ───────────── Traza ─────────────

-- Un lote de asignación (o reasignación) ejecutado desde la consola.
create table ejecuciones (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('asignacion','reasignacion')),
  metodo          text not null,
  parametros      jsonb not null default '{}',
  ejecutado_por   text not null,
  fecha_referencia date not null,      -- "hoy" usado para ausencias/antigüedad (reproducible)
  total_registros int not null default 0,
  creada_en       timestamptz not null default now()
);

-- Una fila por registro asignado. Nunca se sobrescribe: reasignar crea otra fila
-- y marca la anterior como no vigente.
create table asignaciones (
  id               uuid primary key default gen_random_uuid(),
  ejecucion_id     uuid not null references ejecuciones(id),
  registro_id      int  not null references registros(id),
  usuario_id       int  not null references usuarios(id),
  metodo           text not null,
  parametros       jsonb not null default '{}',
  ejecutado_por    text not null,
  creada_en        timestamptz not null default now(),
  reemplaza_a      uuid references asignaciones(id),
  vigente          boolean not null default true,
  motivo           text,               -- explicación legible de por qué se eligió a este usuario
  candidatos       jsonb,              -- puntaje / descarte de cada candidato evaluado
  prompt_enviado   text,               -- método IA: prompt completo, con los datos del registro
  respuesta_modelo text,               -- método IA: respuesta cruda del modelo
  modelo           text                -- método IA: id del modelo usado
);
-- Un registro solo puede tener una asignación vigente.
create unique index asignaciones_una_vigente_idx on asignaciones(registro_id) where vigente;
create index asignaciones_usuario_idx on asignaciones(usuario_id) where vigente;

-- ───────────── Seguridad ─────────────
-- Toda la app accede por servidor con la secret/service_role key (que ignora RLS).
-- Con RLS activo y sin políticas, la anon/publishable key no puede leer nada.
alter table equipos       enable row level security;
alter table usuarios      enable row level security;
alter table registros     enable row level security;
alter table ausencias     enable row level security;
alter table actividad     enable row level security;
alter table ejecuciones   enable row level security;
alter table asignaciones  enable row level security;

-- ───────────── Previsualizaciones (método IA) ─────────────
-- El modelo no es determinista: lo que se ejecuta es EXACTAMENTE lo que se previsualizó
-- (con su prompt y respuesta), no una nueva consulta al modelo.
drop table if exists previsualizaciones cascade;
create table previsualizaciones (
  id          uuid primary key default gen_random_uuid(),
  metodo      text not null,
  solicitud   jsonb not null,
  resultado   jsonb not null,
  creada_en   timestamptz not null default now(),
  usada_en    timestamptz
);
alter table previsualizaciones enable row level security;

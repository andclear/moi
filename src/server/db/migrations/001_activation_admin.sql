create table if not exists activation_codes (
  id text primary key,
  code text not null unique,
  status text not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  activation_session_id text,
  duration_hours integer not null default 72,
  usage_limit integer not null default 100,
  usage_count integer not null default 0
);

create table if not exists activation_sessions (
  id text primary key,
  activation_code_id text not null references activation_codes(id),
  session_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  usage_limit integer not null default 100,
  usage_count integer not null default 0,
  disabled_at timestamptz
);

create table if not exists admin_audit_logs (
  id text primary key,
  actor text not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists model_channel_settings (
  id text primary key,
  preset_enabled boolean not null default false,
  model text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null
);

alter table activation_codes
  add column if not exists duration_hours integer not null default 72;

alter table activation_sessions
  alter column expires_at drop not null;

alter table model_channel_settings
  alter column preset_enabled set default false;

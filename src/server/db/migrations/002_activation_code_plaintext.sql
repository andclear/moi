alter table activation_codes
  add column if not exists code text;

update activation_codes
set code = id
where code is null;

alter table activation_codes
  alter column code set not null;

create unique index if not exists activation_codes_code_key
  on activation_codes(code);

alter table activation_codes
  drop column if exists code_hash,
  drop column if exists deleted_at;

alter table activation_sessions
  alter column expires_at drop not null;

import { createId } from "../../shared/lib/ids.js";
import { createPostgresClient } from "../db/postgres.js";

export async function hashSessionSecret(secret: string) {
  const bytes = new TextEncoder().encode(secret.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createActivationCodeRecord(input: {
  code: string;
  usageLimit: number;
  durationHours: number;
  sql?: ReturnType<typeof createPostgresClient>;
}) {
  const sql = input.sql ?? createPostgresClient();
  const id = createId("activation_code");
  const code = input.code.trim();

  await sql`
    insert into activation_codes (id, code, status, duration_hours, usage_limit)
    values (${id}, ${code}, 'unused', ${input.durationHours}, ${input.usageLimit})
  `;

  return { id, code };
}

export async function createActivationCodeBatch(input: {
  codes: string[];
  usageLimit: number;
  durationHours: number;
  sql?: ReturnType<typeof createPostgresClient>;
}) {
  const records = [];
  const sql = input.sql ?? createPostgresClient();
  for (const code of input.codes) {
    records.push(
      await createActivationCodeRecord({
        code,
        usageLimit: input.usageLimit,
        durationHours: input.durationHours,
        sql,
      }),
    );
  }
  return records;
}

export type ActivationCodeStatusFilter = "all" | "unused" | "used";

export async function listActivationCodes(
  input: {
    page?: number;
    pageSize?: number;
    status?: ActivationCodeStatusFilter;
    sql?: ReturnType<typeof createPostgresClient>;
  } = {},
) {
  const sql = input.sql ?? createPostgresClient();
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(30, Math.max(1, Math.floor(input.pageSize ?? 30)));
  const offset = (page - 1) * pageSize;
  const status = input.status ?? "all";

  const rows = await sql`
    select
      activation_codes.id,
      activation_codes.code,
      case
        when activation_codes.status = 'used'
          and activation_codes.expires_at is not null
          and activation_codes.expires_at <= now()
          then 'expired'
        else activation_codes.status
      end as status,
      activation_codes.created_at,
      activation_codes.activated_at,
      activation_codes.expires_at,
      activation_codes.duration_hours,
      coalesce(activation_sessions.usage_limit, activation_codes.usage_limit) as usage_limit,
      coalesce(activation_sessions.usage_count, activation_codes.usage_count) as usage_count,
      case
        when activation_codes.status = 'used'
          and activation_codes.expires_at is not null
          and activation_codes.expires_at > now()
          then floor(extract(epoch from (activation_codes.expires_at - now())))::integer
        else null
      end as remaining_seconds
    from activation_codes
    left join activation_sessions
      on activation_sessions.id = activation_codes.activation_session_id
    where
      (${status} = 'all')
      or (${status} = 'unused' and activation_codes.status = 'unused')
      or (${status} = 'used' and activation_codes.status = 'used')
    order by
      case when activation_codes.status = 'unused' then 0 else 1 end,
      activation_codes.created_at desc
    limit ${pageSize}
    offset ${offset}
  `;
  const totalRows = await sql`
    select count(*)::integer as total
    from activation_codes
    where
      (${status} = 'all')
      or (${status} = 'unused' and activation_codes.status = 'unused')
      or (${status} = 'used' and activation_codes.status = 'used')
  `;
  const total = Number((totalRows[0] as { total?: number | string } | undefined)?.total ?? 0);

  return { rows, total, page, pageSize, status };
}

export async function disableActivationCode(id: string, sql = createPostgresClient()) {
  await sql`
    update activation_codes
    set status = 'disabled'
    where id = ${id}
  `;
}

export async function deleteActivationCode(id: string, sql = createPostgresClient()) {
  await sql`
    delete from activation_sessions
    where activation_code_id = ${id}
  `;
  await sql`
    delete from activation_codes
    where id = ${id}
  `;
}

import { createPostgresClient } from "@/server/db/postgres";
import { createId } from "@/shared/lib/ids";

export async function hashActivationSecret(secret: string) {
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
  const codeHash = await hashActivationSecret(input.code);
  const id = createId("activation_code");

  await sql`
    insert into activation_codes (id, code_hash, status, duration_hours, usage_limit)
    values (${id}, ${codeHash}, 'unused', ${input.durationHours}, ${input.usageLimit})
  `;

  return { id, codeHash };
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

export async function listActivationCodes(sql = createPostgresClient()) {
  return sql`
    select
      id,
      case
        when status = 'used' and expires_at <= now() then 'expired'
        else status
      end as status,
      created_at,
      activated_at,
      expires_at,
      duration_hours,
      usage_limit,
      usage_count,
      case
        when status = 'used' and expires_at > now() then floor(extract(epoch from (expires_at - now())))::integer
        else null
      end as remaining_seconds
    from activation_codes
    where deleted_at is null
    order by created_at desc
  `;
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
    update activation_codes
    set
      status = 'deleted',
      deleted_at = now()
    where id = ${id}
  `;
}

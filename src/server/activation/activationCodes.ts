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
  sql?: ReturnType<typeof createPostgresClient>;
}) {
  const sql = input.sql ?? createPostgresClient();
  const codeHash = await hashActivationSecret(input.code);
  const id = createId("activation_code");

  await sql`
    insert into activation_codes (id, code_hash, status, usage_limit)
    values (${id}, ${codeHash}, 'unused', ${input.usageLimit})
  `;

  return { id, codeHash };
}

export async function listActivationCodes(sql = createPostgresClient()) {
  return sql`
    select id, status, created_at, activated_at, expires_at, usage_limit, usage_count
    from activation_codes
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

import { createId } from "../../shared/lib/ids.js";
import { createPostgresClient } from "../db/postgres.js";

export async function writeAdminAuditLog(input: {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
  sql?: ReturnType<typeof createPostgresClient>;
}) {
  const sql = input.sql ?? createPostgresClient();
  await sql`
    insert into admin_audit_logs (id, actor, action, metadata)
    values (${createId("audit")}, ${input.actor}, ${input.action}, ${JSON.stringify(
      input.metadata ?? {},
    )})
  `;
}

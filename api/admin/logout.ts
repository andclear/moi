import { writeAdminAuditLog } from "../../src/server/admin/adminAudit";

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return Response.json({ error: "仅支持 POST 请求。" }, { status: 405 });
  }

  await writeAdminAuditLog({ actor: "admin", action: "admin.logout" }).catch(() => undefined);
  return Response.json({ ok: true });
}

import { isAdminRequest } from "../../src/server/admin/adminAuth";
import {
  createActivationCodeRecord,
  disableActivationCode,
  listActivationCodes,
} from "../../src/server/activation/activationCodes";
import { writeAdminAuditLog } from "../../src/server/admin/adminAudit";
import { createId } from "../../src/shared/lib/ids";

function createPlainActivationCode() {
  return createId("echo_code").replace(/_/g, "-");
}

export default async function handler(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "未登录后台。" }, { status: 401 });
  }

  if (request.method === "GET") {
    return Response.json({ codes: await listActivationCodes() });
  }

  if (request.method === "POST") {
    const payload = (await request.json().catch(() => ({}))) as { usageLimit?: number };
    const code = createPlainActivationCode();
    const record = await createActivationCodeRecord({
      code,
      usageLimit: payload.usageLimit ?? 100,
    });
    await writeAdminAuditLog({
      actor: "admin",
      action: "activation_code.create",
      metadata: { id: record.id },
    }).catch(() => undefined);
    return Response.json({ ...record, code });
  }

  if (request.method === "DELETE") {
    const payload = (await request.json().catch(() => ({}))) as { id?: string };
    if (!payload.id) {
      return Response.json({ error: "缺少激活码 ID。" }, { status: 400 });
    }
    await disableActivationCode(payload.id);
    await writeAdminAuditLog({
      actor: "admin",
      action: "activation_code.disable",
      metadata: { id: payload.id },
    }).catch(() => undefined);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "不支持的请求方法。" }, { status: 405 });
}

import { writeAdminAuditLog } from "../../src/server/admin/adminAudit";
import {
  getRequestMethod,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../src/server/runtime/http";

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (getRequestMethod(request) !== "POST") {
    return sendJson({ error: "仅支持 POST 请求。" }, { status: 405 }, response);
  }

  await writeAdminAuditLog({ actor: "admin", action: "admin.logout" }).catch(() => undefined);
  return sendJson({ ok: true }, undefined, response);
}

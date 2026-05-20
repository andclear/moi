import { createAdminSessionToken, verifyAdminPassword } from "../../src/server/admin/adminAuth";
import { writeAdminAuditLog } from "../../src/server/admin/adminAudit";
import {
  getRequestMethod,
  readJsonBody,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../src/server/runtime/http";

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (getRequestMethod(request) !== "POST") {
    return sendJson({ error: "仅支持 POST 请求。" }, { status: 405 }, response);
  }

  try {
    const payload = await readJsonBody<{ password?: string }>(request, {});
    if (!payload.password || !(await verifyAdminPassword(payload.password))) {
      return sendJson({ error: "后台密码不正确。" }, { status: 401 }, response);
    }

    const session = await createAdminSessionToken();
    await writeAdminAuditLog({ actor: "admin", action: "admin.login" }).catch(() => undefined);

    return sendJson(
      {
        token: session.token,
        sessionHash: session.hash,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      },
      undefined,
      response,
    );
  } catch (error) {
    return sendJson(
      { error: error instanceof Error ? error.message : "后台登录失败。" },
      { status: 500 },
      response,
    );
  }
}

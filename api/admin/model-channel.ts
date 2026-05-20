import { isAdminRequest } from "../../src/server/admin/adminAuth";
import { writeAdminAuditLog } from "../../src/server/admin/adminAudit";
import {
  getModelChannelSettings,
  saveModelChannelSettings,
} from "../../src/server/admin/modelChannel";
import {
  getRequestMethod,
  readJsonBody,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../src/server/runtime/http";

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (!isAdminRequest(request)) {
    return sendJson({ error: "未登录后台。" }, { status: 401 }, response);
  }

  if (getRequestMethod(request) === "GET") {
    return sendJson(await getModelChannelSettings(), undefined, response);
  }

  if (getRequestMethod(request) === "POST") {
    const payload = await readJsonBody<{ presetEnabled?: boolean; model?: string }>(request, {});
    const settings = await saveModelChannelSettings({
      presetEnabled: Boolean(payload.presetEnabled),
      model: payload.model?.trim() || "预置调用",
      updatedBy: "admin",
    });
    await writeAdminAuditLog({
      actor: "admin",
      action: "model_channel.update",
      metadata: settings,
    }).catch(() => undefined);
    return sendJson(settings, undefined, response);
  }

  return sendJson({ error: "不支持的请求方法。" }, { status: 405 }, response);
}

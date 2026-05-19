import { isAdminRequest } from "../../src/server/admin/adminAuth";
import { writeAdminAuditLog } from "../../src/server/admin/adminAudit";
import {
  getModelChannelSettings,
  saveModelChannelSettings,
} from "../../src/server/admin/modelChannel";

export default async function handler(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "未登录后台。" }, { status: 401 });
  }

  if (request.method === "GET") {
    return Response.json(await getModelChannelSettings());
  }

  if (request.method === "POST") {
    const payload = (await request.json()) as { presetEnabled?: boolean; model?: string };
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
    return Response.json(settings);
  }

  return Response.json({ error: "不支持的请求方法。" }, { status: 405 });
}

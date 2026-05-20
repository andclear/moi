import { activateCode } from "../src/server/activation/activationSessions";
import {
  getRequestMethod,
  readJsonBody,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../src/server/runtime/http";

export const config = {
  maxDuration: 10,
};

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (getRequestMethod(request) !== "POST") {
    return sendJson({ error: "仅支持 POST 请求。" }, { status: 405 }, response);
  }

  try {
    const payload = await readJsonBody<{ code?: string }>(request, {});
    if (!payload.code?.trim()) {
      return sendJson({ error: "请输入激活码。" }, { status: 400 }, response);
    }

    return sendJson(await activateCode(payload.code), undefined, response);
  } catch (error) {
    return sendJson(
      { error: error instanceof Error ? error.message : "激活失败。" },
      { status: 400 },
      response,
    );
  }
}

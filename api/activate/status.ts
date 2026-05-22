import { getActivationSessionStatus } from "../../src/server/activation/activationSessions.js";
import {
  getRequestHeader,
  getRequestMethod,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../src/server/runtime/http.js";

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (getRequestMethod(request) !== "GET") {
    return sendJson({ error: "仅支持 GET 请求。" }, { status: 405 }, response);
  }

  try {
    const authorization = getRequestHeader(request, "authorization");
    const sessionToken = authorization.replace(/^Bearer\s+/i, "");
    if (!sessionToken) {
      return sendJson({ error: "缺少激活会话。" }, { status: 401 }, response);
    }

    return sendJson(await getActivationSessionStatus(sessionToken), undefined, response);
  } catch (error) {
    return sendJson(
      { error: error instanceof Error ? error.message : "激活状态校验失败。" },
      { status: 500 },
      response,
    );
  }
}

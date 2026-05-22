import { proxyPresetLlm, proxyPresetLlmStream } from "../src/server/llm/presetProxy.js";
import {
  getRequestHeader,
  getRequestMethod,
  readJsonBody,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../src/server/runtime/http.js";

export const config = {
  maxDuration: 60,
};

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (getRequestMethod(request) !== "POST") {
    return sendJson({ error: "仅支持 POST 请求。" }, { status: 405 }, response);
  }

  try {
    const authorization = getRequestHeader(request, "authorization");
    const sessionToken = authorization.replace(/^Bearer\s+/i, "");
    if (!sessionToken) {
      return sendJson({ error: "缺少激活会话。" }, { status: 401 }, response);
    }

    const payload = await readJsonBody<{
      messages?: unknown;
      stream?: unknown;
      responseFormat?: unknown;
    }>(request, {});
    if (!Array.isArray(payload.messages)) {
      return sendJson({ error: "缺少模型消息。" }, { status: 400 }, response);
    }

    if (payload.stream === true && !response) {
      return proxyPresetLlmStream({
        sessionToken,
        messages: payload.messages as Parameters<typeof proxyPresetLlm>[0]["messages"],
        responseFormat: payload.responseFormat === "json_object" ? "json_object" : undefined,
      });
    }

    return sendJson(
      await proxyPresetLlm({
        sessionToken,
        messages: payload.messages as Parameters<typeof proxyPresetLlm>[0]["messages"],
        responseFormat: payload.responseFormat === "json_object" ? "json_object" : undefined,
      }),
      undefined,
      response,
    );
  } catch (error) {
    return sendJson(
      { error: error instanceof Error ? error.message : "模型调用失败。" },
      { status: 500 },
      response,
    );
  }
}

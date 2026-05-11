import { proxyPresetLlm } from "../src/server/llm/presetProxy";

export const config = {
  maxDuration: 60,
};

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return Response.json({ error: "仅支持 POST 请求。" }, { status: 405 });
  }

  try {
    const authorization = request.headers.get("authorization") ?? "";
    const sessionToken = authorization.replace(/^Bearer\s+/i, "");
    if (!sessionToken) {
      return Response.json({ error: "缺少激活会话。" }, { status: 401 });
    }

    const payload = (await request.json()) as { messages?: unknown };
    if (!Array.isArray(payload.messages)) {
      return Response.json({ error: "缺少模型消息。" }, { status: 400 });
    }

    return Response.json(
      await proxyPresetLlm({
        sessionToken,
        messages: payload.messages as Parameters<typeof proxyPresetLlm>[0]["messages"],
      }),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "模型调用失败。" },
      { status: 500 },
    );
  }
}

import {
  getRequestMethod,
  readJsonBody,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../src/server/runtime/http.js";

export const config = {
  maxDuration: 60,
};

type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

interface CustomLlmPayload {
  apiBaseUrl?: unknown;
  apiKey?: unknown;
  model?: unknown;
  temperature?: unknown;
  supportsSystemPrompt?: unknown;
  messages?: unknown;
  stream?: unknown;
  responseFormat?: unknown;
}

function normalizeBaseUrl(url: string) {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "");
}

function isLlmMessage(value: unknown): value is LlmMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<LlmMessage>;
  return (
    (message.role === "system" || message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function shouldEnableDeepSeekThinking(apiBaseUrl: string, model: string) {
  return `${apiBaseUrl} ${model}`.toLowerCase().includes("deepseek");
}

function adaptMessagesForSystemSupport(messages: LlmMessage[], supportsSystemPrompt: boolean) {
  if (supportsSystemPrompt) {
    return messages;
  }

  const [first, ...rest] = messages;
  if (first?.role !== "system") {
    return messages;
  }

  const nextUserIndex = rest.findIndex((message) => message.role === "user");
  if (nextUserIndex < 0) {
    return [{ role: "user" as const, content: first.content }, ...rest];
  }

  return rest.map((message, index) =>
    index === nextUserIndex
      ? {
          ...message,
          content: `${first.content}\n\n${message.content}`,
        }
      : message,
  );
}

function buildRequestBody(input: {
  apiBaseUrl: string;
  model: string;
  temperature: number;
  supportsSystemPrompt: boolean;
  messages: LlmMessage[];
  stream: boolean;
  responseFormat?: "json_object";
}) {
  const body: Record<string, unknown> = {
    model: input.model,
    temperature: input.temperature,
    messages: adaptMessagesForSystemSupport(input.messages, input.supportsSystemPrompt),
  };

  if (input.stream) {
    body.stream = true;
  }

  if (input.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  if (shouldEnableDeepSeekThinking(input.apiBaseUrl, input.model)) {
    body.reasoning_effort = "high";
    body.thinking = { type: "enabled" };
  }

  return body;
}

function isUnsupportedResponseFormatError(errorText: string) {
  return /response_format|json_schema|json_object/i.test(errorText);
}

function parsePayload(payload: CustomLlmPayload) {
  const apiBaseUrl = typeof payload.apiBaseUrl === "string" ? payload.apiBaseUrl.trim() : "";
  const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
  const model = typeof payload.model === "string" ? payload.model.trim() : "";
  const temperature =
    typeof payload.temperature === "number" && Number.isFinite(payload.temperature)
      ? payload.temperature
      : 0.7;
  const supportsSystemPrompt =
    typeof payload.supportsSystemPrompt === "boolean" ? payload.supportsSystemPrompt : true;
  const messages = Array.isArray(payload.messages) ? payload.messages.filter(isLlmMessage) : [];

  if (!apiBaseUrl || !apiKey || !model || messages.length === 0) {
    throw new Error("自配 API 信息不完整。");
  }

  return {
    apiBaseUrl,
    apiKey,
    model,
    temperature,
    supportsSystemPrompt,
    messages,
    stream: payload.stream === true,
    responseFormat:
      payload.responseFormat === "json_object" ? ("json_object" as const) : undefined,
  };
}

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (getRequestMethod(request) !== "POST") {
    return sendJson({ error: "仅支持 POST 请求。" }, { status: 405 }, response);
  }

  try {
    const input = parsePayload(await readJsonBody<CustomLlmPayload>(request, {}));
    const upstreamUrl = `${normalizeBaseUrl(input.apiBaseUrl)}/chat/completions`;
    const requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    };
    let upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(buildRequestBody(input)),
    });

    if (!upstream.ok && input.responseFormat === "json_object") {
      const errorText = await upstream.text().catch(() => "");
      if (isUnsupportedResponseFormatError(errorText)) {
        upstream = await fetch(upstreamUrl, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(buildRequestBody({ ...input, responseFormat: undefined })),
        });
      } else {
        return sendJson(
          { error: errorText || "自配模型请求失败。" },
          { status: upstream.status },
          response,
        );
      }
    }

    if (!upstream.ok) {
      return sendJson(
        { error: (await upstream.text().catch(() => "")) || "自配模型请求失败。" },
        { status: upstream.status },
        response,
      );
    }

    if (input.stream && !response) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    return sendJson(await upstream.json(), undefined, response);
  } catch (error) {
    return sendJson(
      {
        error:
          error instanceof Error
            ? `自配 API 请求失败：${error.message}`
            : "自配 API 请求失败。",
      },
      { status: 500 },
      response,
    );
  }
}

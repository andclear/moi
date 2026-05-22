import type { ApiSettings } from "@/db/types";
import { adaptMessagesForSystemSupport } from "@/features/llm/promptAdapter";
import { LlmError, type LlmMessage, type LlmResponse } from "@/features/llm/llmTypes";
import { readTextResponse } from "@/features/llm/streamParser";

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string }; text?: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export function normalizeOpenAiBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function shouldEnableDeepSeekThinking(settings: Pick<ApiSettings, "apiBaseUrl" | "model">) {
  const signature = `${settings.apiBaseUrl} ${settings.model}`.toLowerCase();
  return signature.includes("deepseek");
}

export function buildOpenAiRequestBody(
  settings: Pick<ApiSettings, "apiBaseUrl" | "model" | "temperature" | "supportsSystemPrompt">,
  messages: LlmMessage[],
  stream: boolean,
  responseFormat?: "json_object",
) {
  const body: Record<string, unknown> = {
    model: settings.model,
    temperature: settings.temperature,
    messages: adaptMessagesForSystemSupport(messages, settings.supportsSystemPrompt),
  };

  if (stream) {
    body.stream = true;
  }

  if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  if (shouldEnableDeepSeekThinking(settings)) {
    body.reasoning_effort = "high";
    body.thinking = { type: "enabled" };
  }

  return body;
}

export async function callOpenAiCompatible(
  settings: ApiSettings,
  messages: LlmMessage[],
  signal?: AbortSignal,
  onDelta?: (delta: string, content: string) => void,
  responseFormat?: "json_object",
): Promise<LlmResponse> {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model) {
    throw new LlmError("自配 API 信息不完整。", "custom_api_incomplete");
  }

  const startedAt = performance.now();
  const response = await fetch("/api/custom-llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiBaseUrl: settings.apiBaseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      temperature: settings.temperature,
      supportsSystemPrompt: settings.supportsSystemPrompt,
      messages,
      stream: Boolean(onDelta),
      responseFormat,
    }),
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    const errorText = payload?.error ?? (await response.text().catch(() => ""));
    throw new LlmError(errorText || "自配模型请求失败。", "custom_api_failed");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const content = await readTextResponse(response, onDelta);

    return {
      content,
      raw: { streamed: true },
      usage: {
        durationMs: Math.round(performance.now() - startedAt),
      },
    };
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text ?? "";
  if (content) {
    onDelta?.(content, content);
  }

  return {
    content,
    raw: payload,
    usage: {
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens,
      durationMs: Math.round(performance.now() - startedAt),
    },
  };
}

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

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export async function callOpenAiCompatible(
  settings: ApiSettings,
  messages: LlmMessage[],
  signal?: AbortSignal,
  onDelta?: (delta: string, content: string) => void,
): Promise<LlmResponse> {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model) {
    throw new LlmError("自配 API 信息不完整。", "custom_api_incomplete");
  }

  const startedAt = performance.now();
  const response = await fetch(`${normalizeBaseUrl(settings.apiBaseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      messages: adaptMessagesForSystemSupport(messages, settings.supportsSystemPrompt),
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new LlmError(errorText || "模型请求失败。", "custom_api_failed");
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

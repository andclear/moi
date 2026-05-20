import type { LlmMessage } from "../../features/llm/llmTypes";
import { getModelChannelSettings } from "../admin/modelChannel";
import {
  incrementActivationUsage,
  verifyActivationSession,
} from "../activation/activationSessions";
import { createPostgresClient } from "../db/postgres";
import { getEnv } from "../runtime/env";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

async function resolvePresetConfig(sessionToken: string) {
  const sql = createPostgresClient();
  const channel = await getModelChannelSettings(sql);
  if (!channel.presetEnabled) {
    throw new Error("预置模型渠道暂未开启。");
  }

  const session = await verifyActivationSession(sessionToken, sql);
  if (!session) {
    throw new Error("激活状态无效或已经过期。");
  }

  const apiBaseUrl = getEnv("PRESET_API_BASE_URL");
  const apiKey = getEnv("PRESET_API_KEY");
  const model = getEnv("PRESET_MODEL");
  if (!apiBaseUrl || !apiKey || !model) {
    throw new Error("服务端预置模型配置不完整。");
  }

  return { sql, session, apiBaseUrl, apiKey, model };
}

function buildPresetRequestBody(input: { model: string; messages: LlmMessage[]; stream?: boolean }) {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    temperature: 0.7,
  };

  if (input.stream) {
    body.stream = true;
  }

  if (`${input.model}`.toLowerCase().includes("deepseek")) {
    body.reasoning_effort = "high";
    body.thinking = { type: "enabled" };
  }

  return body;
}

export async function proxyPresetLlm(input: { sessionToken: string; messages: LlmMessage[] }) {
  const { sql, session, apiBaseUrl, apiKey, model } = await resolvePresetConfig(input.sessionToken);

  const startedAt = Date.now();
  const response = await fetch(`${normalizeBaseUrl(apiBaseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildPresetRequestBody({ model, messages: input.messages })),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  await incrementActivationUsage(session.id, sql);

  return {
    content: payload.choices?.[0]?.message?.content ?? "",
    raw: payload,
    usage: {
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens,
      durationMs: Date.now() - startedAt,
    },
  };
}

export async function proxyPresetLlmStream(input: { sessionToken: string; messages: LlmMessage[] }) {
  const { sql, session, apiBaseUrl, apiKey, model } = await resolvePresetConfig(input.sessionToken);
  const response = await fetch(`${normalizeBaseUrl(apiBaseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildPresetRequestBody({ model, messages: input.messages, stream: true })),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  await incrementActivationUsage(session.id, sql);

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

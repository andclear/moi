import { activationRepository } from "@/db/repositories/activationRepository";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import { callOpenAiCompatible } from "@/features/llm/openaiCompatibleClient";
import { LlmError, type LlmRequest, type LlmResponse } from "@/features/llm/llmTypes";
import {
  createGenerationRecord,
  markGenerationFailed,
  markGenerationSucceeded,
} from "@/features/llm/usageTracker";

async function callPresetGateway(request: LlmRequest): Promise<LlmResponse> {
  const activation = await activationRepository.getCurrent();
  if (!activation?.sessionToken || activation.status !== "active") {
    throw new LlmError("预置调用尚未激活。", "preset_not_active");
  }

  const startedAt = performance.now();
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activation.sessionToken}`,
    },
    body: JSON.stringify({
      messages: request.messages,
      projectId: request.projectId,
      type: request.type,
      inputSummary: request.inputSummary,
    }),
    signal: request.signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new LlmError(payload?.error ?? "预置模型请求失败。", "preset_api_failed");
  }

  const payload = (await response.json()) as LlmResponse;
  return {
    ...payload,
    usage: {
      ...payload.usage,
      durationMs: payload.usage?.durationMs ?? Math.round(performance.now() - startedAt),
    },
  };
}

export async function callLlm(request: LlmRequest) {
  const task = await createGenerationRecord({
    projectId: request.projectId,
    type: request.type,
    inputSummary: request.inputSummary,
  });

  try {
    const settings = await settingsRepository.getApiSettings();
    if (!settings || settings.mode === "none") {
      throw new LlmError("尚未配置可用模型。", "api_not_configured");
    }

    const response =
      settings.mode === "preset"
        ? await callPresetGateway(request)
        : await callOpenAiCompatible(settings, request.messages, request.signal);

    await markGenerationSucceeded(task, { content: response.content, raw: response.raw }, response.usage);
    return { taskId: task.id, response };
  } catch (error) {
    await markGenerationFailed(task, error);
    throw error;
  }
}

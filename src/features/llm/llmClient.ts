import { activationRepository } from "@/db/repositories/activationRepository";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import type { GreetingVariant, ProfileStageId, TrialRun, WorldEntry } from "@/db/types";
import type {
  GreetingPersonType,
  GreetingRoleTone,
} from "@/features/greeting/greetingStore";
import { buildProfileDraftMessages, buildProfileStageMessages } from "@/prompts/profilePrompts";
import { buildGreetingMessages } from "@/prompts/greetingPrompts";
import { buildTrialAnswerMessages, buildTrialQuestionnaireMessages } from "@/prompts/trialPrompts";
import { buildWorldEntryMessages } from "@/prompts/worldPrompts";
import { callOpenAiCompatible } from "@/features/llm/openaiCompatibleClient";
import { parseLlmJson } from "@/features/llm/jsonResponse";
import { LlmError, type LlmRequest, type LlmResponse } from "@/features/llm/llmTypes";
import {
  createGenerationRecord,
  markGenerationFailed,
  markGenerationSucceeded,
} from "@/features/llm/usageTracker";
import type { TrialMode } from "@/features/trial/trialStore";
import {
  greetingVariantResponseSchema,
  profileChoiceResponseSchema,
  profileDraftResponseSchema,
  trialAnswerResponseSchema,
  trialQuestionnaireResponseSchema,
  worldEntryResponseSchema,
} from "@/schemas/llmResponseSchemas";

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

export async function generateProfileDraft(input: {
  projectId: string;
  brief: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "profile",
    messages: buildProfileDraftMessages(input.brief),
    inputSummary: input.brief.slice(0, 160),
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, profileDraftResponseSchema),
    response: result.response,
  };
}

export async function generateProfileStage(input: {
  projectId: string;
  stageId: ProfileStageId;
  dossierMarkdown: string;
  previousChoices: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "profile",
    messages: buildProfileStageMessages({
      stageId: input.stageId,
      dossierMarkdown: input.dossierMarkdown,
      previousChoices: input.previousChoices,
    }),
    inputSummary: `侧写子步骤：${input.stageId}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, profileChoiceResponseSchema),
    response: result.response,
  };
}

export async function generateWorldEntries(input: {
  projectId: string;
  dossierMarkdown: string;
  confirmedEntries: WorldEntry[];
  userRequest: string;
  entryCount: number;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "world",
    messages: buildWorldEntryMessages(input),
    inputSummary: `生成 ${input.entryCount} 条 WorldInfo：${input.userRequest.slice(0, 80)}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, worldEntryResponseSchema),
    response: result.response,
  };
}

export async function generateGreetingVariants(input: {
  projectId: string;
  dossierMarkdown: string;
  confirmedEntries: WorldEntry[];
  userRole: GreetingRoleTone;
  wordCount: number;
  personType: GreetingPersonType;
  mustInclude: string;
  heatLevel: number;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "greeting",
    messages: buildGreetingMessages(input),
    inputSummary: `生成开场白：${input.userRole} / ${input.personType} / ${input.wordCount}字`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, greetingVariantResponseSchema),
    response: result.response,
  };
}

export async function generateTrialQuestionnaire(input: {
  projectId: string;
  dossierMarkdown: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  mode: TrialMode;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "trial_questionnaire",
    messages: buildTrialQuestionnaireMessages(input),
    inputSummary: `终审问卷：${input.mode}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, trialQuestionnaireResponseSchema),
    response: result.response,
  };
}

export async function generateTrialAnswer(input: {
  projectId: string;
  dossierMarkdown: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  mode: TrialRun["mode"];
  questionnaireMarkdown: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "trial_answer",
    messages: buildTrialAnswerMessages(input),
    inputSummary: `终审回答：${input.mode}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, trialAnswerResponseSchema),
    response: result.response,
  };
}

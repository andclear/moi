import { activationRepository } from "@/db/repositories/activationRepository";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import type { GreetingVariant, ProfileStageId, TrialRun, WorldEntry } from "@/db/types";
import type {
  GreetingPersonType,
  GreetingRoleTone,
} from "@/features/greeting/greetingStore";
import { buildProfileDraftMessages, buildProfileStageMessages } from "@/prompts/profilePrompts";
import { buildGreetingMessages } from "@/prompts/greetingPrompts";
import { buildBeautificationMessages } from "@/prompts/beautificationPrompts";
import { buildCompanionMessages } from "@/prompts/companionPrompts";
import { buildTrialAnswerMessages, buildTrialQuestionnaireMessages } from "@/prompts/trialPrompts";
import { buildWorldEntryMessages } from "@/prompts/worldPrompts";
import { buildIntakeQuestionnaireMessages } from "@/prompts/intakePrompts";
import { withGlobalPrompt } from "@/prompts/globalPrompt";
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
  beautificationResponseSchema,
  companionResponseSchema,
  intakeQuestionnaireResponseSchema,
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
  if (payload.content) {
    request.onDelta?.(payload.content, payload.content);
  }
  return {
    ...payload,
    usage: {
      ...payload.usage,
      durationMs: payload.usage?.durationMs ?? Math.round(performance.now() - startedAt),
    },
  };
}

export async function generateBeautificationAsset(input: {
  projectId: string;
  dossierMarkdown: string;
  originalText: string;
  userRequest: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "beautification",
    messages: buildBeautificationMessages(input),
    inputSummary: `生成美化与正则：${input.userRequest.slice(0, 80) || input.originalText.slice(0, 80)}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, beautificationResponseSchema),
    response: result.response,
  };
}

export async function generateCompanionCandidates(input: {
  projectId: string;
  dossierMarkdown: string;
  confirmedEntries: WorldEntry[];
  userRequest: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "companion",
    messages: buildCompanionMessages(input),
    inputSummary: `寻找配角：${input.userRequest.slice(0, 100)}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, companionResponseSchema),
    response: result.response,
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

    const normalizedRequest: LlmRequest = {
      ...request,
      messages: withGlobalPrompt(request.messages),
    };

    const response =
      settings.mode === "preset"
        ? await callPresetGateway(normalizedRequest)
        : await callOpenAiCompatible(
            settings,
            normalizedRequest.messages,
            normalizedRequest.signal,
            normalizedRequest.onDelta,
          );

    await markGenerationSucceeded(task, { content: response.content, raw: response.raw }, response.usage);
    return { taskId: task.id, response };
  } catch (error) {
    await markGenerationFailed(task, error);
    throw error;
  }
}

function extractDesignNote(content: string) {
  const match = /<cot>([\s\S]*?)(?:<\/cot>|$)/i.exec(content);
  if (match?.[1]?.trim()) {
    return match[1].trim();
  }

  const jsonStart = content.indexOf("{");
  const leadingText = (jsonStart >= 0 ? content.slice(0, jsonStart) : content)
    .replace(/<\/?cot>/gi, "")
    .trim();

  return leadingText.startsWith("{") ? "" : leadingText;
}

function normalizeIntakeOptions(
  options: Array<{ label: string; allowCustom?: boolean }>,
) {
  const dedupedOptions = options.reduce<Array<{ label: string; allowCustom: boolean }>>(
    (result, option) => {
      const label = option.label.trim();
      if (!label || result.some((item) => item.label === label)) {
        return result;
      }

      result.push({
        label,
        allowCustom: Boolean(option.allowCustom) || label.includes("其他"),
      });
      return result;
    },
    [],
  );

  if (dedupedOptions.length <= 6) {
    return dedupedOptions;
  }

  const customOption = dedupedOptions.find((option) => option.allowCustom || option.label.includes("其他"));
  const fixedOptions = dedupedOptions.filter((option) => option !== customOption).slice(0, 5);
  return customOption ? [...fixedOptions, customOption] : dedupedOptions.slice(0, 6);
}

function buildQuestionnaireDesignFallback(data: {
  questions: Array<{ title: string; options: Array<{ label: string; allowCustom?: boolean }> }>;
}) {
  const directions = data.questions
    .slice(0, 7)
    .map((question, index) => `${index + 1}. 围绕“${question.title}”确认方向，方便后续把角色写得更具体。`)
    .join("\n");

  return [
    "模型没有返回完整的可见设计说明，已根据问卷内容补充一份摘要：",
    directions,
    "其中带有“其他”的题目会保留自由填写，用来接住选项无法覆盖的设定。",
  ].join("\n");
}

export async function generateIntakeQuestionnaire(input: {
  projectId: string;
  brief: string;
  gender: string;
  age?: string;
  signal?: AbortSignal;
  onDelta?: (delta: string, content: string) => void;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "intake_questionnaire",
    messages: buildIntakeQuestionnaireMessages(input),
    inputSummary: `生成登岛问卷：${input.brief.slice(0, 100)}`,
    signal: input.signal,
    onDelta: input.onDelta,
  });
  const data = parseLlmJson(result.response.content, intakeQuestionnaireResponseSchema);
  const questions = data.questions.slice(0, 7);
  const designNote = extractDesignNote(result.response.content) || buildQuestionnaireDesignFallback(data);

  return {
    taskId: result.taskId,
    data: {
      title: data.title,
      designNote,
      questions: questions.map((question, questionIndex) => ({
        id: `q${questionIndex + 1}`,
        title: question.title,
        description: question.description,
        options: normalizeIntakeOptions(question.options).map((option, optionIndex) => ({
          id: `q${questionIndex + 1}_o${optionIndex + 1}`,
          label: option.label,
          allowCustom: option.allowCustom,
        })),
      })),
    },
    response: result.response,
  };
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
    inputSummary: `认识岛民子步骤：${input.stageId}`,
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
    inputSummary: `相处测试问卷：${input.mode}`,
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
    inputSummary: `相处测试回答：${input.mode}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, trialAnswerResponseSchema),
    response: result.response,
  };
}

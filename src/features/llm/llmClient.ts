import { activationRepository } from "@/db/repositories/activationRepository";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import type {
  BeautificationUiStyleId,
  GreetingVariant,
  HelloChatMessage,
  HelloChatMode,
  ProfileDiaryBlank,
  ProfileStageId,
  TrialRun,
  WorldEntry,
} from "@/db/types";
import {
  parseGreetingResponseText,
  type GreetingPersonType,
} from "@/features/greeting/greetingStore";
import {
  buildProfileDossierUpdateMessages,
  buildProfileDraftMessages,
  buildProfileStageMessages,
} from "@/prompts/profilePrompts";
import { buildGreetingMessages } from "@/prompts/greetingPrompts";
import { buildHelloChatMessages, buildHelloRevisionMessages } from "@/prompts/helloPrompts";
import {
  buildBeautificationKeywordMessages,
  buildBeautificationMessages,
} from "@/prompts/beautificationPrompts";
import { buildCompanionMessages } from "@/prompts/companionPrompts";
import {
  buildTrialAnswerMessages,
  buildTrialQuestionnaireMessages,
  buildTrialRevisionMessages,
} from "@/prompts/trialPrompts";
import { buildWorldDossierUpdateMessages, buildWorldEntryMessages } from "@/prompts/worldPrompts";
import { buildIntakeQuestionnaireMessages } from "@/prompts/intakePrompts";
import {
  buildCharacterProfileTextRewriteMessages,
  buildCharacterProfileYamlMessages,
} from "@/prompts/characterProfilePrompts";
import { withGlobalPrompt } from "@/prompts/globalPrompt";
import { callOpenAiCompatible } from "@/features/llm/openaiCompatibleClient";
import { parseLlmJson } from "@/features/llm/jsonResponse";
import { LlmError, type LlmRequest, type LlmResponse } from "@/features/llm/llmTypes";
import {
  createGenerationRecord,
  markGenerationFailed,
  markGenerationSucceeded,
} from "@/features/llm/usageTracker";
import { readTextResponse } from "@/features/llm/streamParser";
import {
  beautificationKeywordResponseSchema,
  beautificationResponseSchema,
  companionResponseSchema,
  intakeQuestionnaireResponseSchema,
  profileChoiceResponseSchema,
  profileDiaryResponseSchema,
  profileDossierUpdateResponseSchema,
  profileDraftResponseSchema,
  trialAnswerSetResponseSchema,
  trialQuestionnaireSetResponseSchema,
  trialRevisionResponseSchema,
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
      stream: Boolean(request.onDelta),
    }),
    signal: request.signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new LlmError(payload?.error ?? "预置模型请求失败。", "preset_api_failed");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const content = await readTextResponse(response, request.onDelta);
    return {
      content,
      raw: { streamed: true },
      usage: {
        durationMs: Math.round(performance.now() - startedAt),
      },
    };
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
  characterInfoYaml?: string;
  confirmedWorldEntries?: WorldEntry[];
  adoptedGreetings?: GreetingVariant[];
  userRequest: string;
  uiStyle?: BeautificationUiStyleId;
  insertIntoGreeting: "none" | "primary" | "all_adopted";
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "beautification",
    messages: buildBeautificationMessages(input),
    inputSummary: `生成美化与正则：${input.userRequest.slice(0, 80) || "自动生成美化方案"}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, beautificationResponseSchema),
    response: result.response,
  };
}

export async function generateBeautificationKeywords(input: {
  projectId: string;
  userRequest: string;
  worldInfoContent: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "beautification",
    messages: buildBeautificationKeywordMessages(input),
    inputSummary: `补全美化关键词：${input.userRequest.slice(0, 80)}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, beautificationKeywordResponseSchema),
    response: result.response,
  };
}

export async function generateCompanionCandidates(input: {
  projectId: string;
  dossierMarkdown: string;
  characterInfoYaml?: string;
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

    await markGenerationSucceeded(
      task,
      { content: response.content, raw: response.raw },
      response.usage,
    );
    return { taskId: task.id, response };
  } catch (error) {
    await markGenerationFailed(task, error);
    throw error;
  }
}

async function withLlmRetry<T>(factory: () => Promise<T>, maxAttempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("模型请求失败，请重试。");
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

function normalizeIntakeOptions(options: Array<{ label: string; allowCustom?: boolean }>) {
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

  const customOption = dedupedOptions.find(
    (option) => option.allowCustom || option.label.includes("其他"),
  );
  const fixedOptions = dedupedOptions.filter((option) => option !== customOption).slice(0, 5);
  return customOption ? [...fixedOptions, customOption] : dedupedOptions.slice(0, 6);
}

function buildQuestionnaireDesignFallback(data: {
  questions: Array<{ title: string; options: Array<{ label: string; allowCustom?: boolean }> }>;
}) {
  const directions = data.questions
    .slice(0, 7)
    .map(
      (question, index) =>
        `${index + 1}. 围绕“${question.title}”确认方向，方便后续把角色写得更具体。`,
    )
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
  const designNote =
    extractDesignNote(result.response.content) || buildQuestionnaireDesignFallback(data);

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

function normalizeDiaryBlanks(
  blanks: Array<{
    key?: string;
    label: string;
    options: Array<{ label: string; meaning: string }>;
  }>,
): ProfileDiaryBlank[] {
  return blanks.slice(0, 3).map((blank, blankIndex) => {
    const key = blank.key?.trim() || `blank_${blankIndex + 1}`;
    const options = blank.options.slice(0, 3).map((option, optionIndex) => ({
      key: `${key}_option_${optionIndex + 1}`,
      label: option.label.trim(),
      meaning: option.meaning.trim(),
    }));

    return {
      key,
      label: blank.label.trim(),
      options,
    };
  });
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

  if (input.stageId === "diary") {
    const data = parseLlmJson(result.response.content, profileDiaryResponseSchema);
    return {
      taskId: result.taskId,
      data: {
        kind: "diary" as const,
        draft: {
          title: data.title,
          diaryText: data.diaryText,
          note: data.note,
          blanks: normalizeDiaryBlanks(data.blanks),
        },
      },
      response: result.response,
    };
  }

  return {
    taskId: result.taskId,
    data: {
      kind: "choices" as const,
      ...parseLlmJson(result.response.content, profileChoiceResponseSchema),
    },
    response: result.response,
  };
}

export async function generateProfileDossierUpdate(input: {
  projectId: string;
  dossierMarkdown: string;
  previousChoices: string;
  completedDiaryText: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "profile",
    messages: buildProfileDossierUpdateMessages({
      dossierMarkdown: input.dossierMarkdown,
      previousChoices: input.previousChoices,
      completedDiaryText: input.completedDiaryText,
    }),
    inputSummary: "更新岛民档案",
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, profileDossierUpdateResponseSchema),
    response: result.response,
  };
}

export async function generateCharacterProfileYaml(input: {
  projectId: string;
  characterProfile: string;
  previousCharacterInfo?: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "character_profile",
    messages: buildCharacterProfileYamlMessages(
      input.characterProfile,
      input.previousCharacterInfo,
    ),
    inputSummary: "生成角色信息 YAML",
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    yaml: result.response.content
      .replace(/^```(?:yaml)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim(),
    response: result.response,
  };
}

export async function generateDossierTextRewrite(input: {
  projectId: string;
  dossierMarkdown: string;
  characterInfo: string;
  selectedFragment: string;
  revisionNotes: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "dossier_edit",
    messages: buildCharacterProfileTextRewriteMessages({
      dossierMarkdown: input.dossierMarkdown,
      characterInfo: input.characterInfo,
      selectedFragment: input.selectedFragment,
      revisionNotes: input.revisionNotes,
    }),
    inputSummary: `岛民档案局部修改：${input.selectedFragment.slice(0, 60)}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    text: result.response.content
      .replace(/^```(?:txt|text)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim(),
    response: result.response,
  };
}

export async function generateWorldEntries(input: {
  projectId: string;
  dossierMarkdown: string;
  characterInfo: string;
  currentWorldInfo: string;
  existingWorldEntries: WorldEntry[];
  userRequest: string;
  entryCount: number;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "world",
    messages: buildWorldEntryMessages({
      dossierMarkdown: input.dossierMarkdown,
      characterInfo: input.characterInfo,
      currentWorldInfo: input.currentWorldInfo,
      existingWorldEntries: input.existingWorldEntries,
      userRequest: input.userRequest,
      entryCount: input.entryCount,
    }),
    inputSummary: `生成 ${input.entryCount} 条 WorldInfo：${input.userRequest.slice(0, 80)}`,
    signal: input.signal,
  });

  const data = parseLlmJson(result.response.content, worldEntryResponseSchema);
  if (data.length !== input.entryCount) {
    throw new Error(
      `模型返回了 ${data.length} 条 WorldInfo，但本次要求必须是 ${input.entryCount} 条。请重新生成。`,
    );
  }

  return {
    taskId: result.taskId,
    data,
    response: result.response,
  };
}

export async function generateWorldDossierUpdate(input: {
  projectId: string;
  currentCharacterProfile: string;
  currentCharacterInfo: string;
  confirmedWorldEntries: WorldEntry[];
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "world",
    messages: buildWorldDossierUpdateMessages({
      currentCharacterProfile: input.currentCharacterProfile,
      currentCharacterInfo: input.currentCharacterInfo,
      confirmedWorldEntries: input.confirmedWorldEntries,
    }),
    inputSummary: `根据 ${input.confirmedWorldEntries.length} 条 WorldInfo 更新角色档案`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, profileDossierUpdateResponseSchema),
    response: result.response,
  };
}

export async function generateGreetingVariants(input: {
  projectId: string;
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  wordCount: number;
  personType: GreetingPersonType;
  userRequest: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "greeting",
    messages: buildGreetingMessages(input),
    inputSummary: `生成开场白：${input.personType} / ${input.wordCount}字`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseGreetingResponseText(result.response.content),
    response: result.response,
  };
}

export async function generateTrialQuestionnaireSet(input: {
  projectId: string;
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  signal?: AbortSignal;
}) {
  return withLlmRetry(async () => {
    const result = await callLlm({
      projectId: input.projectId,
      type: "trial_questionnaire",
      messages: buildTrialQuestionnaireMessages(input),
      inputSummary: "终审测试三份问卷",
      signal: input.signal,
    });

    return {
      taskId: result.taskId,
      data: parseLlmJson(result.response.content, trialQuestionnaireSetResponseSchema),
      response: result.response,
    };
  });
}

export async function generateTrialAnswerSet(input: {
  projectId: string;
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  questionnaires: string;
  signal?: AbortSignal;
}) {
  return withLlmRetry(async () => {
    const result = await callLlm({
      projectId: input.projectId,
      type: "trial_answer",
      messages: buildTrialAnswerMessages(input),
      inputSummary: "终审测试三份回答",
      signal: input.signal,
    });

    return {
      taskId: result.taskId,
      data: parseLlmJson(result.response.content, trialAnswerSetResponseSchema),
      response: result.response,
    };
  });
}

export async function generateTrialRevision(input: {
  projectId: string;
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  mode: TrialRun["mode"];
  question: string;
  formalReply: string;
  innerMonologue: string;
  revisionNotes: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "trial_revision",
    messages: buildTrialRevisionMessages(input),
    inputSummary: `终审不满意修改：${input.question.slice(0, 60)}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, trialRevisionResponseSchema),
    response: result.response,
  };
}

export async function generateHelloChatReply(input: {
  projectId: string;
  mode: HelloChatMode;
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  historyMessages: HelloChatMessage[];
  userInput: string;
  signal?: AbortSignal;
  onDelta?: (delta: string, content: string) => void;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "hello_chat",
    messages: buildHelloChatMessages(input),
    inputSummary: `打个招呼：${input.userInput.slice(0, 80)}`,
    signal: input.signal,
    onDelta: input.onDelta,
  });

  return {
    taskId: result.taskId,
    text: result.response.content.trim(),
    response: result.response,
  };
}

export async function generateHelloRevision(input: {
  projectId: string;
  mode: HelloChatMode;
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  historyMessages: HelloChatMessage[];
  targetReply: string;
  revisionNotes: string;
  signal?: AbortSignal;
}) {
  const result = await callLlm({
    projectId: input.projectId,
    type: "hello_revision",
    messages: buildHelloRevisionMessages(input),
    inputSummary: `对话不满意修改：${input.targetReply.slice(0, 60)}`,
    signal: input.signal,
  });

  return {
    taskId: result.taskId,
    data: parseLlmJson(result.response.content, trialRevisionResponseSchema),
    response: result.response,
  };
}

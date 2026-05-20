import type { GenerationTask, Project, WorldEntry } from "@/db/types";
import { collectPromptWorldEntries } from "@/features/world/worldPromptContext";
import { getAdoptedGreetingVariants, type GreetingPersonType } from "@/features/greeting/greetingStore";
import { extractCurrentWorldInfo, formatWorldEntriesJson } from "@/prompts/worldPrompts";
import { buildIntakeQuestionnaireMessages } from "@/prompts/intakePrompts";
import {
  buildProfileDossierUpdateMessages,
  buildProfileDraftMessages,
  buildProfileStageMessages,
} from "@/prompts/profilePrompts";
import {
  buildCharacterProfileTextRewriteMessages,
  buildCharacterProfileYamlMessages,
} from "@/prompts/characterProfilePrompts";
import { buildWorldDossierUpdateMessages, buildWorldEntryMessages } from "@/prompts/worldPrompts";
import { buildGreetingMessages } from "@/prompts/greetingPrompts";
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
import { buildHelloChatMessages, buildHelloRevisionMessages } from "@/prompts/helloPrompts";
import { withGlobalPrompt } from "@/prompts/globalPrompt";
import type { LlmMessage } from "@/features/llm/llmTypes";
import { stripRuntimeTimestamps } from "@/shared/lib/jsonSanitizer";

export interface DebugVariable {
  name: string;
  label: string;
  usedBy: string[];
  value: unknown;
}

export interface DebugPromptPreview {
  id: string;
  title: string;
  description: string;
  variables: string[];
  messages: LlmMessage[];
  messagesWithGlobalPrompt: LlmMessage[];
}

export interface DebugProjectSnapshot {
  project: Project;
  promptWorldEntries: WorldEntry[];
  variables: DebugVariable[];
  promptPreviews: DebugPromptPreview[];
  storageSections: Array<{
    id: string;
    title: string;
    value: unknown;
  }>;
  diagnostics: Array<{
    title: string;
    value: string;
  }>;
}

export function sanitizeDebugValue(value: unknown): unknown {
  return stripRuntimeTimestamps(value);
}

function stringify(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(sanitizeDebugValue(value), null, 2);
}

function getLatestHelloSession(project: Project) {
  return [...(project.helloSessions ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

function getLatestTrialRun(project: Project) {
  return [...project.trialRuns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function getLatestGenerationWithMessages(generations: GenerationTask[]) {
  return generations.find((task) => {
    const output = task.output as { requestMessages?: unknown } | undefined;
    return Array.isArray(output?.requestMessages);
  });
}

function getGenerationMessages(task?: GenerationTask) {
  const output = task?.output as { requestMessages?: LlmMessage[] } | undefined;
  return Array.isArray(output?.requestMessages) ? output.requestMessages : [];
}

function getWorldInfoDiagnostics(project: Project, promptWorldEntries: WorldEntry[]) {
  const beautificationWorldCount = (project.beautifications ?? []).filter(
    (asset) => asset.enabled && asset.worldInfo,
  ).length;
  const normalEnabledCount = project.worldEntries.filter((entry) => entry.enabled).length;
  const statusLikeEntries = promptWorldEntries.filter((entry) =>
    /statusblock|状态栏|HUD|数值面板|面板|状态/.test(`${entry.title}\n${entry.content}`),
  );

  return [
    {
      title: "普通启用 WorldInfo",
      value: `${normalEnabledCount} 条`,
    },
    {
      title: "启用美化 WorldInfo",
      value: `${beautificationWorldCount} 条`,
    },
    {
      title: "prompt 最终注入 WorldInfo",
      value: `${promptWorldEntries.length} 条`,
    },
    {
      title: "疑似状态栏相关条目",
      value: statusLikeEntries.length
        ? statusLikeEntries.map((entry) => `${entry.title}（${entry.id}）`).join("、")
        : "未检测到包含 statusblock / 状态栏 / HUD / 面板关键词的条目",
    },
  ];
}

function makeQuestionnairesPreview() {
  return JSON.stringify(
    {
      modes: {
        interview: {
          title: "多面试官对话",
          questions: [{ id: "interview_1", question: "调试用问题", intent: "检查变量" }],
        },
        stress: {
          title: "风浪压测",
          questions: [{ id: "stress_1", question: "调试用问题", intent: "检查变量" }],
        },
        diary: {
          title: "日记来信",
          questions: [{ id: "diary_1", question: "调试用问题", intent: "检查变量" }],
        },
      },
    },
    null,
    2,
  );
}

function addPrompt(
  previews: DebugPromptPreview[],
  input: {
    id: string;
    title: string;
    description: string;
    variables: string[];
    messages: LlmMessage[];
  },
) {
  previews.push({
    ...input,
    messagesWithGlobalPrompt: withGlobalPrompt(input.messages),
  });
}

export function buildDebugProjectSnapshot(
  project: Project,
  generations: GenerationTask[] = [],
): DebugProjectSnapshot {
  const promptWorldEntries = collectPromptWorldEntries(project);
  const adoptedGreetings = getAdoptedGreetingVariants(project);
  const selectedGreeting = adoptedGreetings[0] ?? project.greetingVariants[0];
  const latestSession = getLatestHelloSession(project);
  const latestTrial = getLatestTrialRun(project);
  const latestGenerationWithMessages = getLatestGenerationWithMessages(generations);
  const latestGenerationMessages = getGenerationMessages(latestGenerationWithMessages);
  const characterInfoYaml = project.characterProfile?.yaml ?? "";
  const currentWorldInfo = extractCurrentWorldInfo(project);
  const latestHistory = latestSession?.messages ?? [];
  const latestUserMessage =
    [...latestHistory].reverse().find((message) => message.role === "user")?.content ??
    "调试用户输入：请继续。";
  const latestAssistantReply =
    [...latestHistory].reverse().find((message) => message.role === "assistant")?.content ??
    "调试 AI 回复。";
  const trialQuestion =
    latestTrial?.modeResults?.interview.questions[0]?.question ?? "调试终审问题。";
  const trialAnswer =
    latestTrial?.modeResults?.interview.answers[0] ?? {
      questionId: "interview_1",
      formalReply: "调试正式回复。",
      innerMonologue: "调试内心独白。",
      riskSentences: [],
    };
  const firstBeautification = project.beautifications[0];
  const prompts: DebugPromptPreview[] = [];

  addPrompt(prompts, {
    id: "intake_questionnaire",
    title: "登岛问卷",
    description: "使用最初线索、性别、年龄。",
    variables: ["最初线索", "性别", "年龄"],
    messages: buildIntakeQuestionnaireMessages({
      brief: project.intake?.brief ?? project.dossier.markdown,
      gender: project.intake?.gender ?? "未填写",
      age: project.intake?.age,
    }),
  });

  addPrompt(prompts, {
    id: "profile_draft",
    title: "认识岛民初稿",
    description: "使用最初线索生成角色档案初稿。",
    variables: ["最初线索"],
    messages: buildProfileDraftMessages(project.intake?.brief ?? project.dossier.markdown),
  });

  addPrompt(prompts, {
    id: "profile_stage",
    title: "认识岛民阶段题",
    description: "使用角色档案和已确认选择。",
    variables: ["角色档案", "认识岛民已确认选择"],
    messages: buildProfileStageMessages({
      stageId: project.profileSession?.currentStageId ?? "silhouette",
      dossierMarkdown: project.dossier.markdown,
      previousChoices: stringify(project.profileSession?.stages ?? "暂无"),
    }),
  });

  addPrompt(prompts, {
    id: "profile_dossier_update",
    title: "认识岛民更新档案",
    description: "使用角色档案、已确认选择、日记文本。",
    variables: ["角色档案", "认识岛民已确认选择", "日记文本"],
    messages: buildProfileDossierUpdateMessages({
      dossierMarkdown: project.dossier.markdown,
      previousChoices: stringify(project.profileSession?.stages ?? "暂无"),
      completedDiaryText:
        project.profileSession?.stages.diary.completedDiaryText ??
        project.profileSession?.stages.diary.diaryDraft?.diaryText ??
        "暂无",
    }),
  });

  addPrompt(prompts, {
    id: "character_profile_yaml",
    title: "生成角色信息 YAML",
    description: "使用角色档案和已有角色信息 YAML。",
    variables: ["角色档案", "角色信息 YAML"],
    messages: buildCharacterProfileYamlMessages(project.dossier.markdown, characterInfoYaml),
  });

  addPrompt(prompts, {
    id: "dossier_edit",
    title: "局部修改角色档案",
    description: "使用角色档案、角色信息、选中文本和修改意见。",
    variables: ["角色档案", "角色信息 YAML", "选中文本", "修改意见"],
    messages: buildCharacterProfileTextRewriteMessages({
      dossierMarkdown: project.dossier.markdown,
      characterInfo: characterInfoYaml,
      selectedFragment: project.dossier.markdown.slice(0, 300) || "调试选中文本",
      revisionNotes: "调试修改意见。",
    }),
  });

  addPrompt(prompts, {
    id: "world_entry",
    title: "生成 WorldInfo",
    description: "使用角色档案、角色信息、当前世界信息、已有世界书和生成需求。",
    variables: ["角色档案", "角色信息 YAML", "当前世界信息", "已有世界书条目", "世界书生成需求", "条目数量"],
    messages: buildWorldEntryMessages({
      dossierMarkdown: project.dossier.markdown,
      characterInfo: characterInfoYaml || "尚未生成",
      currentWorldInfo,
      existingWorldEntries: promptWorldEntries,
      userRequest: "调试需求：根据当前角色补充一条关键 WorldInfo。",
      entryCount: 1,
    }),
  });

  addPrompt(prompts, {
    id: "world_dossier_update",
    title: "WorldInfo 写回角色档案",
    description: "使用角色档案、角色信息和已确认 WorldInfo。",
    variables: ["角色档案", "角色信息 YAML", "worldinfo"],
    messages: buildWorldDossierUpdateMessages({
      currentCharacterProfile: project.dossier.markdown,
      currentCharacterInfo: characterInfoYaml || "尚未生成",
      confirmedWorldEntries: promptWorldEntries,
    }),
  });

  addPrompt(prompts, {
    id: "greeting",
    title: "生成开场白",
    description: "使用角色档案、角色信息、WorldInfo、字数、视角和用户要求。",
    variables: ["角色档案", "角色信息 YAML", "worldinfo", "开场白字数", "叙事视角", "开场白生成要求"],
    messages: buildGreetingMessages({
      dossierMarkdown: project.dossier.markdown,
      characterInfoYaml,
      confirmedEntries: promptWorldEntries,
      wordCount: selectedGreeting?.content.length || 500,
      personType: "第三人称" satisfies GreetingPersonType,
      userRequest: "调试需求：生成一条开场白。",
    }),
  });

  addPrompt(prompts, {
    id: "beautification",
    title: "生成美化",
    description: "使用角色档案、角色信息、WorldInfo、已采用开场白、美化需求和风格。",
    variables: ["角色档案", "角色信息 YAML", "worldinfo", "已采用开场白合集", "美化需求", "美化样式", "是否插入开场白"],
    messages: buildBeautificationMessages({
      dossierMarkdown: project.dossier.markdown,
      characterInfoYaml,
      confirmedWorldEntries: promptWorldEntries,
      adoptedGreetings,
      userRequest: firstBeautification?.userRequest ?? "调试需求：生成状态栏美化。",
      uiStyle: firstBeautification?.uiStyle ?? "none",
      insertIntoGreeting: firstBeautification?.insertIntoGreeting ?? "none",
    }),
  });

  addPrompt(prompts, {
    id: "beautification_keywords",
    title: "补全美化关键词",
    description: "使用美化需求和 WorldInfo 内容。",
    variables: ["美化需求", "worldinfo"],
    messages: buildBeautificationKeywordMessages({
      userRequest: firstBeautification?.userRequest ?? "调试需求：生成状态栏美化。",
      worldInfoContent: firstBeautification?.worldInfo?.content ?? promptWorldEntries[0]?.content ?? "暂无",
    }),
  });

  addPrompt(prompts, {
    id: "companion",
    title: "生成配角",
    description: "使用角色档案、角色信息、WorldInfo 和配角需求。",
    variables: ["角色档案", "角色信息 YAML", "worldinfo", "配角需求"],
    messages: buildCompanionMessages({
      dossierMarkdown: project.dossier.markdown,
      characterInfoYaml,
      confirmedEntries: promptWorldEntries,
      userRequest: "调试需求：寻找一个关系紧密的配角。",
    }),
  });

  addPrompt(prompts, {
    id: "trial_questionnaire",
    title: "终审问卷",
    description: "使用角色档案、角色信息、WorldInfo 和已采用开场白。",
    variables: ["角色档案", "角色信息 YAML", "worldinfo", "已采用开场白"],
    messages: buildTrialQuestionnaireMessages({
      dossierMarkdown: project.dossier.markdown,
      characterInfoYaml,
      confirmedEntries: promptWorldEntries,
      selectedGreeting,
    }),
  });

  addPrompt(prompts, {
    id: "trial_answer",
    title: "终审回答",
    description: "使用角色档案、角色信息、WorldInfo、已采用开场白和问卷 JSON。",
    variables: ["角色档案", "角色信息 YAML", "worldinfo", "已采用开场白", "问卷 JSON"],
    messages: buildTrialAnswerMessages({
      dossierMarkdown: project.dossier.markdown,
      characterInfoYaml,
      confirmedEntries: promptWorldEntries,
      selectedGreeting,
      questionnaires: makeQuestionnairesPreview(),
    }),
  });

  addPrompt(prompts, {
    id: "trial_revision",
    title: "终审不满意修改",
    description: "使用基础资料、当前问题、回答和不满意原因。",
    variables: ["角色档案", "角色信息 YAML", "worldinfo", "已采用开场白", "终审问题", "正式回复", "内心独白", "不满意原因"],
    messages: buildTrialRevisionMessages({
      dossierMarkdown: project.dossier.markdown,
      characterInfoYaml,
      confirmedEntries: promptWorldEntries,
      selectedGreeting,
      mode: latestTrial?.mode ?? "interview",
      question: trialQuestion,
      formalReply: trialAnswer.formalReply,
      innerMonologue: trialAnswer.innerMonologue,
      revisionNotes: "调试不满意原因。",
    }),
  });

  addPrompt(prompts, {
    id: "hello_greeting",
    title: "打个招呼：从开场白开始",
    description: "使用 WorldInfo、角色档案、角色信息、选中开场白、聊天记录和用户输入。",
    variables: ["worldinfo", "角色档案", "角色信息 YAML", "当前选择开场白", "聊天记录", "用户输入内容"],
    messages: buildHelloChatMessages({
      mode: "greeting",
      dossierMarkdown: project.dossier.markdown,
      characterInfoYaml,
      confirmedEntries: promptWorldEntries,
      selectedGreeting,
      historyMessages: latestHistory,
      userInput: latestUserMessage,
    }),
  });

  addPrompt(prompts, {
    id: "hello_casual",
    title: "打个招呼：简单聊聊",
    description: "使用 WorldInfo、角色档案、角色信息、聊天记录和用户输入。",
    variables: ["worldinfo", "角色档案", "角色信息 YAML", "聊天记录", "用户输入内容"],
    messages: buildHelloChatMessages({
      mode: "casual",
      dossierMarkdown: project.dossier.markdown,
      characterInfoYaml,
      confirmedEntries: promptWorldEntries,
      historyMessages: latestHistory,
      userInput: latestUserMessage,
    }),
  });

  addPrompt(prompts, {
    id: "hello_revision",
    title: "打个招呼：回复不满意修改",
    description: "使用基础资料、聊天记录、目标回复和不满意原因。",
    variables: ["worldinfo", "角色档案", "角色信息 YAML", "当前选择开场白", "聊天记录", "AI 回复", "不满意原因"],
    messages: buildHelloRevisionMessages({
      mode: latestSession?.mode ?? "greeting",
      dossierMarkdown: project.dossier.markdown,
      characterInfoYaml,
      confirmedEntries: promptWorldEntries,
      selectedGreeting,
      historyMessages: latestHistory,
      targetReply: latestAssistantReply,
      revisionNotes: "调试不满意原因。",
    }),
  });

  const variables: DebugVariable[] = [
    {
      name: "dossierMarkdown",
      label: "角色档案",
      usedBy: prompts.filter((prompt) => prompt.variables.includes("角色档案")).map((prompt) => prompt.title),
      value: project.dossier.markdown,
    },
    {
      name: "characterInfoYaml",
      label: "角色信息 YAML",
      usedBy: prompts
        .filter((prompt) => prompt.variables.includes("角色信息 YAML"))
        .map((prompt) => prompt.title),
      value: characterInfoYaml || "尚未生成角色信息 YAML。",
    },
    {
      name: "worldEntries",
      label: "worldinfo（prompt 最终注入）",
      usedBy: prompts.filter((prompt) => prompt.variables.includes("worldinfo")).map((prompt) => prompt.title),
      value: promptWorldEntries,
    },
    {
      name: "worldEntriesJson",
      label: "worldinfo JSON 形态",
      usedBy: ["生成 WorldInfo", "生成美化"],
      value: formatWorldEntriesJson(promptWorldEntries),
    },
    {
      name: "rawWorldEntries",
      label: "原始 worldEntries",
      usedBy: ["数据存储状态"],
      value: project.worldEntries,
    },
    {
      name: "beautificationWorldInfo",
      label: "美化方案内置 WorldInfo",
      usedBy: ["worldinfo 合并", "生成美化", "打个招呼"],
      value: project.beautifications.map((asset) => ({
        id: asset.id,
        title: asset.title,
        enabled: asset.enabled,
        worldInfo: asset.worldInfo,
      })),
    },
    {
      name: "greetingVariants",
      label: "全部开场白",
      usedBy: ["开场白选择", "数据存储状态"],
      value: project.greetingVariants,
    },
    {
      name: "adoptedGreetings",
      label: "已采用开场白合集",
      usedBy: prompts
        .filter((prompt) => prompt.variables.includes("已采用开场白合集") || prompt.variables.includes("已采用开场白"))
        .map((prompt) => prompt.title),
      value: adoptedGreetings,
    },
    {
      name: "selectedGreeting",
      label: "当前选择开场白",
      usedBy: prompts
        .filter((prompt) => prompt.variables.includes("当前选择开场白"))
        .map((prompt) => prompt.title),
      value: selectedGreeting ?? "暂无",
    },
    {
      name: "selectedGreetingVisibleLength",
      label: "当前选择开场白可见字数参考",
      usedBy: ["打个招呼：从开场白开始"],
      value: selectedGreeting?.content.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "").replace(/\s+/g, "").length ?? 0,
    },
    {
      name: "chatHistory",
      label: "聊天记录",
      usedBy: prompts.filter((prompt) => prompt.variables.includes("聊天记录")).map((prompt) => prompt.title),
      value: latestHistory,
    },
    {
      name: "latestUserInput",
      label: "用户输入内容",
      usedBy: prompts
        .filter((prompt) => prompt.variables.includes("用户输入内容"))
        .map((prompt) => prompt.title),
      value: latestUserMessage,
    },
    {
      name: "latestAssistantReply",
      label: "AI 回复",
      usedBy: prompts.filter((prompt) => prompt.variables.includes("AI 回复")).map((prompt) => prompt.title),
      value: latestAssistantReply,
    },
    {
      name: "intake",
      label: "登岛问卷与初始输入",
      usedBy: ["登岛问卷", "认识岛民初稿", "当前世界信息提取"],
      value: project.intake ?? "暂无",
    },
    {
      name: "profileSession",
      label: "认识岛民阶段状态",
      usedBy: ["认识岛民阶段题", "认识岛民更新档案"],
      value: project.profileSession ?? "暂无",
    },
    {
      name: "currentWorldInfo",
      label: "当前世界信息",
      usedBy: ["生成 WorldInfo"],
      value: currentWorldInfo,
    },
    {
      name: "trialRuns",
      label: "终审测试记录",
      usedBy: ["终审回答", "终审不满意修改", "数据存储状态"],
      value: project.trialRuns,
    },
    {
      name: "beautifications",
      label: "美化方案",
      usedBy: ["生成美化", "美化关键词", "worldinfo 合并", "数据存储状态"],
      value: project.beautifications,
    },
    {
      name: "companions",
      label: "配角与关系网",
      usedBy: ["数据存储状态"],
      value: {
        companions: project.companions,
        companionRelations: project.companionRelations,
      },
    },
    {
      name: "latestGenerationRequestMessages",
      label: "最近一次真实发送的 requestMessages",
      usedBy: ["生成记录排查"],
      value: latestGenerationMessages.length
        ? {
            generationId: latestGenerationWithMessages?.id,
            type: latestGenerationWithMessages?.type,
            inputSummary: latestGenerationWithMessages?.inputSummary,
            messages: latestGenerationMessages,
          }
        : "暂无带 requestMessages 的生成记录。请重新触发一次模型调用后再查看。",
    },
  ];

  return {
    project,
    promptWorldEntries,
    variables,
    promptPreviews: prompts,
    storageSections: [
      { id: "project", title: "完整 Project 原始存储", value: project },
      { id: "dossier", title: "角色档案 dossier", value: project.dossier },
      { id: "character_profile", title: "角色信息 characterProfile", value: project.characterProfile ?? "暂无" },
      { id: "world_entries", title: "原始 worldEntries", value: project.worldEntries },
      { id: "prompt_world_entries", title: "prompt 最终注入 WorldInfo", value: promptWorldEntries },
      { id: "greetings", title: "开场白 greetingVariants", value: project.greetingVariants },
      { id: "beautifications", title: "美化 beautifications", value: project.beautifications },
      { id: "trial_runs", title: "终审 trialRuns", value: project.trialRuns },
      { id: "hello_sessions", title: "聊天 helloSessions", value: project.helloSessions ?? [] },
      { id: "generations", title: "最近生成记录 generations", value: generations },
    ],
    diagnostics: getWorldInfoDiagnostics(project, promptWorldEntries),
  };
}

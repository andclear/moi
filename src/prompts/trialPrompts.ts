import type { TrialMode } from "@/features/trial/trialStore";
import type { LlmMessage } from "@/features/llm/llmTypes";
import type { GreetingVariant, WorldEntry } from "@/db/types";

export interface BuildTrialQuestionnaireMessagesInput {
  dossierMarkdown: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  mode: TrialMode;
}

export interface BuildTrialAnswerMessagesInput extends BuildTrialQuestionnaireMessagesInput {
  questionnaireMarkdown: string;
}

const modeDescriptions: Record<TrialMode, string> = {
  interview: "多面试官对话：三位提问者分别从关系、行动、底线角度提出问题，观察角色表达是否稳定。",
  stress: "极压测试：问题从日常推进到信念质疑、创伤触碰和珍视之人相关，但必须避免廉价崩溃。",
  diary: "小记对话：引用核心矛盾或内心记忆，检验过去誓言与当前行为之间的张力。",
  silent: "安静对话：问题要让正式回答与内心独白形成合理反差。",
};

function formatWorldInfo(entries: WorldEntry[]) {
  return entries.length
    ? entries.map((entry) => `WorldInfo - ${entry.title}\n${entry.content}`).join("\n\n")
    : "尚未确认 WorldInfo。";
}

export function buildTrialQuestionnaireMessages(
  input: BuildTrialQuestionnaireMessagesInput,
): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是角色一致性测试助手，任务是生成一份温和但有效的角色一致性测试问卷。",
        "问题必须服务于确认 {{char}} 是否稳定，不要制造压迫感，不要像刑讯。",
        "输出只能是标准 JSON 对象，包含 title 和 questionnaireMarkdown。",
        "questionnaireMarkdown 必须是中文 Markdown，包含 6 个问题，并标明提问者或场景。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `测试模式：${modeDescriptions[input.mode]}`,
        `角色记录：\n${input.dossierMarkdown}`,
        `WorldInfo：\n${formatWorldInfo(input.confirmedEntries)}`,
        `已选开场白：\n${input.selectedGreeting?.content ?? "尚未选定。请基于角色记录测试。"}`,
      ].join("\n\n"),
    },
  ];
}

export function buildTrialAnswerMessages(input: BuildTrialAnswerMessagesInput): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你将扮演角色 {{char}} 完成相处测试问卷，同时给出可供创作者判断的内心独白与 OOC 风险。",
        "严格使用简体中文。必须保留 {{char}} 与 {{user}} 字面占位符。",
        "正式回复应像角色自然说话，不要解释设定。内心独白可以暴露没有说出口的迟疑、偏见、保护欲或矛盾。",
        "输出只能是标准 JSON 对象，包含 resultMarkdown、formalReplies、innerMonologues、riskNotes。",
        "resultMarkdown 需要以对话形式展示每个问题、正式回复、内心独白。riskNotes 若无风险则返回空数组。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `测试模式：${modeDescriptions[input.mode]}`,
        `角色记录：\n${input.dossierMarkdown}`,
        `WorldInfo：\n${formatWorldInfo(input.confirmedEntries)}`,
        `已选开场白：\n${input.selectedGreeting?.content ?? "尚未选定。"}`,
        `问卷：\n${input.questionnaireMarkdown}`,
      ].join("\n\n"),
    },
  ];
}

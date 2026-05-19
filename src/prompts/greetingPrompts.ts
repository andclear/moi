import type { GreetingPersonType, GreetingRoleTone } from "@/features/greeting/greetingStore";
import type { LlmMessage } from "@/features/llm/llmTypes";
import type { WorldEntry } from "@/db/types";

export interface BuildGreetingMessagesInput {
  dossierMarkdown: string;
  confirmedEntries: WorldEntry[];
  userRole: GreetingRoleTone;
  wordCount: number;
  personType: GreetingPersonType;
  mustInclude: string;
  heatLevel: number;
}

const roleDescriptions: Record<GreetingRoleTone, string> = {
  stranger: "陌生人：{{user}} 与 {{char}} 第一次交会，关系未知但必须有可继续互动的钩子。",
  client: "委托人：{{user}} 带着请求或秘密靠近 {{char}}，双方都有信息缺口。",
  old_friend: "老友：{{user}} 与 {{char}} 曾经相识，重逢里有未说完的旧事。",
  enemy: "敌人：{{user}} 与 {{char}} 立场相冲，但互动要保持平等和真实张力。",
};

function formatWorldInfo(entries: WorldEntry[]) {
  if (entries.length === 0) {
    return "尚未确认 WorldInfo。请主要依照角色记录生成。";
  }

  return entries
    .map((entry) => `WorldInfo - ${entry.title}\n${entry.content}`)
    .join("\n\n");
}

export function buildGreetingMessages(input: BuildGreetingMessagesInput): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是角色扮演开场白创意导演，负责生成能立刻引发互动的开场白候选。",
        "严格使用简体中文，叙事字段必须保留字面占位符 {{char}} 与 {{user}}，不能替换成具体名字。",
        "禁止描写 {{user}} 的思想、情绪或台词，只能描述必要的被动位置和外部可见情境。",
        "拒绝套路寒暄、霸总式压迫、油腻占有、无条件迷恋。紧张感来自未完成的事、冲突、危险、欲望或沉默。",
        "所有对白必须使用中文双引号包裹。",
        "输出只能是标准 JSON 数组，长度为 2 到 3。每个元素包含 title、content、atmosphere。",
        "不要输出 Markdown，不要输出 <cot>，不要输出 JSON 以外的内容。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `角色记录：\n${input.dossierMarkdown}`,
        `已确认 WorldInfo：\n${formatWorldInfo(input.confirmedEntries)}`,
        `用户身份：${roleDescriptions[input.userRole]}`,
        `目标字数：每个开场白约 ${input.wordCount} 字，允许上下浮动 20%。`,
        `人称模式：${input.personType}。第一人称使用“我”指代 {{char}}；第二人称聚焦 {{user}} 可看见、听见、触碰到的外部细节；第三人称使用 {{char}} 或他/她。`,
        `语气热烈程度：${input.heatLevel}/5。1 表示克制冷静，5 表示强烈但仍尊重边界。`,
        `必须包含的要素：${input.mustInclude || "无特别要求。请从角色记录和 WorldInfo 中选择最有张力的触点。"}`,
      ].join("\n\n"),
    },
  ];
}

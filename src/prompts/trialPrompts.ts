import type { GreetingVariant, WorldEntry } from "@/db/types";
import { readCharacterNameFromYaml } from "@/features/greeting/greetingStore";
import type { LlmMessage } from "@/features/llm/llmTypes";
import type { TrialMode } from "@/features/trial/trialStore";

export interface BuildTrialQuestionnaireMessagesInput {
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
}

export interface BuildTrialAnswerMessagesInput extends BuildTrialQuestionnaireMessagesInput {
  questionnaires: string;
}

export interface BuildTrialRevisionMessagesInput extends BuildTrialQuestionnaireMessagesInput {
  mode: TrialMode;
  question: string;
  formalReply: string;
  innerMonologue: string;
  revisionNotes: string;
}

export const trialModeDescriptions: Record<TrialMode, string> = {
  interview:
    "多面试官对话：三位固定风格的虚拟面试官从不同角度提问，用于观察角色在不同关系压力下的表达稳定性；每个问答结果同时展示角色正式回复和内心独白。内心独白用于检验角色是否有合理反差。",
  stress:
    "极压测试：AI 问卷从日常话题逐步升级到信念质疑、创伤触碰和珍视之人相关问题，前端根据模型返回的风险标注和角色档案关键事实进行基础比对，并高亮可能存在 OOC 风险的句子。",
  diary:
    "日记对话：AI 问卷引用私密日记或核心矛盾内容，要求角色回应过去誓言与当前行为之间的张力。用于检验人物弧光是否合理，而不是制造强压迫感。",
};

function formatWorldInfo(entries: WorldEntry[]) {
  return entries.length
    ? entries
        .map((entry) => `WorldInfo ID：${entry.id}\n标题：${entry.title}\n内容：${entry.content}`)
        .join("\n\n")
    : "尚未确认 WorldInfo。";
}

function formatReference(input: BuildTrialQuestionnaireMessagesInput) {
  return [
    `角色档案：\n${input.dossierMarkdown}`,
    `角色信息 YAML：\n${input.characterInfoYaml?.trim() || "尚未生成角色信息 YAML。"}`,
    `WorldInfo：\n${formatWorldInfo(input.confirmedEntries)}`,
    `已采用开场白：\n${
      input.selectedGreeting
        ? `开场白 ID：${input.selectedGreeting.id}\n内容：${input.selectedGreeting.content}`
        : "尚未采用开场白。"
    }`,
  ].join("\n\n");
}

export function buildTrialQuestionnaireMessages(
  input: BuildTrialQuestionnaireMessagesInput,
): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是角色终审测试问卷设计助手。你的任务是一次性生成三份问卷。",
        "所有内容必须使用简体中文，表达简单、直白、清晰，不追求文学性，不增加阅读成本。",
        "问题要具体、可回答、可用于判断角色一致性；不要制造廉价压迫，不要使用审讯语气。",
        "必须同时生成 interview、stress、diary 三个模式，不能漏项，不能新增其他模式。",
        "每个模式生成 4 个问题。问题 ID 必须稳定，格式为 interview_1、stress_1、diary_1。",
        "输出只能是标准 JSON 对象，不要输出 Markdown 代码块，不要输出解释。",
        "所有 JSON 字段都必须使用正确类型：字符串字段必须是非空字符串，数组字段必须是数组。禁止输出 null；可选字段没有内容时直接省略。",
        'JSON 结构必须是：{"modes":{"interview":{"title":"三席岛访","questions":[{"id":"interview_1","interviewer":"提问者名称","question":"问题","intent":"测试目的"}]},"stress":{"title":"风浪压测","questions":[]},"diary":{"title":"日记来信","questions":[]}}}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请根据以下三种测试要求，一次性生成三份问卷。",
        `interview：${trialModeDescriptions.interview}`,
        `stress：${trialModeDescriptions.stress}`,
        `diary：${trialModeDescriptions.diary}`,
        formatReference(input),
      ].join("\n\n"),
    },
  ];
}

export function buildTrialAnswerMessages(input: BuildTrialAnswerMessagesInput): LlmMessage[] {
  const characterName = readCharacterNameFromYaml(input.characterInfoYaml) || "角色真实姓名";

  return [
    {
      role: "system",
      content: [
        `你现在扮演 ${characterName} 完成终审测试问卷。你必须以角色第一视角回答。`,
        "所有内容必须使用简体中文，表达简单、直白、清晰，不追求文学性，不增加阅读成本。",
        `回答中角色使用真实姓名 ${characterName}，用户必须使用 {{user}}。`,
        "每道题都必须返回正式回复和内心独白。正式回复是角色会说出口的话；内心独白是没有说出口的真实想法。",
        "内心独白可以与正式回复有反差，但必须符合角色档案、角色信息、WorldInfo 和开场白，不要为了戏剧性而崩坏。",
        "riskSentences 只填写回答中可能 OOC、和关键事实冲突、或情绪推进过猛的句子；没有风险返回空数组。",
        "必须同时回答 interview、stress、diary 三份问卷，不能漏题，questionId 必须和问卷 ID 一致。",
        "输出只能是标准 JSON 对象，不要输出 Markdown 代码块，不要输出解释。",
        "所有 JSON 字段都必须使用正确类型：字符串字段必须是非空字符串，数组字段必须是数组。禁止输出 null；可选字段没有内容时直接省略。",
        'JSON 结构必须是：{"modes":{"interview":{"title":"三席岛访","answers":[{"questionId":"interview_1","formalReply":"正式回复","innerMonologue":"内心独白","riskSentences":[]}],"riskNotes":[]},"stress":{"title":"风浪压测","answers":[],"riskNotes":[]},"diary":{"title":"日记来信","answers":[],"riskNotes":[]}}}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请参考资料并回答下方三份问卷。",
        formatReference(input),
        `问卷 JSON：\n${input.questionnaires}`,
      ].join("\n\n"),
    },
  ];
}

export function buildTrialRevisionMessages(input: BuildTrialRevisionMessagesInput): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是虚拟角色资料修订助手。用户对终审回答不满意，你需要判断应该修改角色档案、角色信息 YAML、WorldInfo 或开场白中的哪一部分。",
        "所有内容必须使用简体中文，表达简单、直白、清晰，不追求文学性。",
        "修改必须针对资料本身，不要只重写这次回答。优先做最小必要修改，避免大段重写。",
        "如果多个资料位置都可以解决问题，修改优先级必须是：角色信息 YAML ＞ WorldInfo ＞ 角色档案 ＞ 开场白。",
        "只有当更高优先级资料里找不到明确可替换内容，或修改后会破坏事实一致性时，才选择更低优先级资料。",
        "before 必须一字不改地引用原文中实际存在的连续文本；如果找不到可替换原文，就不要生成该 change。",
        "source 只能是 dossier、character_info、worldinfo、greeting。",
        "所有 JSON 字段都必须使用正确类型：字符串字段必须是非空字符串，数组字段必须是数组。禁止输出 null；可选字段没有内容时直接省略。",
        "targetId 规则：source 为 dossier 或 character_info 时，不要输出 targetId 字段；source 为 worldinfo 时，targetId 必须填写资料中实际存在的 WorldInfo ID；source 为 greeting 时，targetId 必须填写资料中实际存在的开场白 ID。",
        "如果你无法确定某条 change 的 targetId，或者找不到 before 对应的原文，就必须删除这条 change，不要用 null、空字符串、unknown、N/A 或占位 ID。",
        "changes 只保留可以被程序直接应用的修改项；不能应用的建议写进 summary，不要放进 changes。",
        "输出只能是标准 JSON 对象，不要输出 Markdown 代码块，不要输出解释。",
        'JSON 结构必须是：{"summary":"这次建议修改什么","changes":[{"source":"dossier","targetId":"可选 ID","title":"修改位置","before":"修改前原文","after":"修改后文本","reason":"为什么这样改"}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "用户不满意一次终审回答，请给出可确认的资料修改建议。",
        formatReference(input),
        `测试模式：${input.mode}`,
        `当前问题：${input.question}`,
        `正式回复：${input.formalReply}`,
        `内心独白：${input.innerMonologue}`,
        `用户的不满意原因或修改意见：${input.revisionNotes}`,
      ].join("\n\n"),
    },
  ];
}

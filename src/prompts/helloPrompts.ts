import type { GreetingVariant, HelloChatMessage, HelloChatMode, WorldEntry } from "@/db/types";
import { readCharacterNameFromYaml } from "@/features/greeting/greetingStore";
import type { LlmMessage } from "@/features/llm/llmTypes";

export interface BuildHelloChatMessagesInput {
  mode: HelloChatMode;
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  historyMessages: HelloChatMessage[];
  userInput: string;
}

export interface BuildHelloRevisionMessagesInput {
  mode: HelloChatMode;
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
  historyMessages: HelloChatMessage[];
  targetReply: string;
  revisionNotes: string;
}

function formatWorldInfo(entries: WorldEntry[]) {
  return entries.length
    ? entries
        .map((entry) =>
          [
            `WorldInfo ID：${entry.id}`,
            `标题：${entry.title}`,
            `常驻：${entry.constant ? "是" : "否"}`,
            `关键词：${entry.constant ? "无，常驻生效" : entry.keys.join("、") || "未设置"}`,
            `插入位置：${entry.position ?? "未设置"}`,
            `深度：${entry.depth ?? "未设置"}`,
            `插入顺序：${entry.insertionOrder ?? "未设置"}`,
            `内容：${entry.content}`,
          ].join("\n"),
        )
        .join("\n\n")
    : "尚未确认 WorldInfo。";
}

function formatGreeting(greeting?: GreetingVariant) {
  return greeting
    ? `开场白 ID：${greeting.id}\n内容：${greeting.content}`
    : "尚未选择开场白。";
}

function formatReference(input: {
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  selectedGreeting?: GreetingVariant;
}) {
  return [
    `WorldInfo：\n${formatWorldInfo(input.confirmedEntries)}`,
    `角色档案：\n${input.dossierMarkdown}`,
    `角色信息 YAML：\n${input.characterInfoYaml?.trim() || "尚未生成角色信息 YAML。"}`,
    `开场白：\n${formatGreeting(input.selectedGreeting)}`,
  ].join("\n\n");
}

function formatChatHistory(messages: HelloChatMessage[], characterName: string) {
  if (messages.length === 0) {
    return "暂无聊天记录。";
  }

  return messages
    .map((message, index) => {
      const role = message.role === "user" ? "{{user}}" : characterName;
      const opening = message.isOpening ? "（第 0 轮开场白）" : "";
      return `${index + 1}. ${role}${opening}：\n${message.content}`;
    })
    .join("\n\n");
}

function countVisibleCharacters(value?: string) {
  if (!value) {
    return 0;
  }

  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "").length;
}

export function buildHelloChatMessages(input: BuildHelloChatMessagesInput): LlmMessage[] {
  const hasHistory = input.historyMessages.length > 0;
  const greetingCharacterCount = countVisibleCharacters(input.selectedGreeting?.content);
  const worldInfoText = formatWorldInfo(input.confirmedEntries);
  const characterName = readCharacterNameFromYaml(input.characterInfoYaml) || "角色真实姓名";
  const modeRule =
    input.mode === "greeting"
      ? [
          "当前是“从开场白开始”模式。开场白算作第 0 轮聊天记录；你可以延续开场白里的场景、格式、HTML/CSS/JavaScript 结构和可被正则匹配的文本。",
          "如果 WorldInfo 或开场白要求持续输出状态栏、statusblock、HUD、数值面板或其他固定结构，你必须在本轮回复中保留对应结构，并保持字段名、标签和换行稳定，方便前端正则匹配和渲染。",
          greetingCharacterCount > 0
            ? `本轮回复的可见正文长度应和开场白接近。当前选中开场白约 ${greetingCharacterCount} 字，请控制在约 ${Math.max(80, Math.round(greetingCharacterCount * 0.75))} 到 ${Math.round(greetingCharacterCount * 1.25)} 字之间。`
            : "本轮回复的可见正文长度应和开场白接近，不要明显短于或长于开场白。",
        ].join("\n")
      : "当前是“简单聊聊”模式。只进行纯文字对话，像朋友聊天一样，不要主动输出 HTML、CSS、JavaScript 或状态栏代码。";

  return [
    {
      role: "system",
      content: [
        `你从现在开始进行角色扮演对话，只扮演 ${characterName}，不要替 {{user}} 说话。`,
        "必须严格参考 WorldInfo、角色档案和角色信息 YAML，保持人物设定、事实、关系和语气稳定。",
        "下面的 WorldInfo 是高优先级硬约束，不是普通背景。凡是常驻 WorldInfo，必须在每一轮回复中持续遵守；凡是要求输出固定结构、状态栏、statusblock、HUD 或数值面板的条目，必须按条目要求输出对应文本。",
        `高优先级 WorldInfo：\n${worldInfoText}`,
        modeRule,
        "回复必须使用简体中文，简单、直白、清晰易懂，不追求文学性，不增加用户阅读成本。",
        `角色使用真实姓名 ${characterName}，用户必须使用 {{user}}。`,
        `只输出 ${characterName} 本轮回复正文，不要输出解释、标题或 Markdown 代码块。`,
      ].join("\n"),
    },
    {
      role: "user",
      content: hasHistory
        ? [
            "请根据以下资料、完整聊天记录和用户最新输入，继续对话。",
            formatReference(input),
            `聊天记录：\n${formatChatHistory(input.historyMessages, characterName)}`,
            `用户输入内容：\n${input.userInput}`,
          ].join("\n\n")
        : [
            "请根据以下资料和用户输入，开始第一轮对话。",
            formatReference(input),
            `用户输入内容：\n${input.userInput}`,
          ].join("\n\n"),
    },
  ];
}

export function buildHelloRevisionMessages(input: BuildHelloRevisionMessagesInput): LlmMessage[] {
  const characterName = readCharacterNameFromYaml(input.characterInfoYaml) || "角色真实姓名";

  return [
    {
      role: "system",
      content: [
        "你是虚拟角色资料修订助手。用户对一条聊天回复不满意，你需要判断应该修改角色档案、角色信息 YAML、WorldInfo 或开场白中的哪一部分。",
        "所有内容必须使用简体中文，表达简单、直白、清晰，不追求文学性。",
        "修改必须针对资料本身，不要只重写这次回复。优先做最小必要修改，避免大段重写。",
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
        "用户不满意一条聊天回复，请给出可确认的资料修改建议。",
        `对话模式：${input.mode === "greeting" ? "从开场白开始" : "简单聊聊"}`,
        formatReference(input),
        `完整聊天记录：\n${formatChatHistory(input.historyMessages, characterName)}`,
        `用户不满意的 AI 回复：\n${input.targetReply}`,
        `用户的不满意原因或修改意见：\n${input.revisionNotes}`,
      ].join("\n\n"),
    },
  ];
}

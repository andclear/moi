import type { WorldEntry } from "@/db/types";
import type { LlmMessage } from "@/features/llm/llmTypes";

export interface BuildWorldMessagesInput {
  dossierMarkdown: string;
  confirmedEntries: WorldEntry[];
  userRequest: string;
  entryCount: number;
}

function formatCurrentWorldInfo(entries: WorldEntry[]) {
  if (entries.length === 0) {
    return "尚未确认任何 WorldInfo 条目。";
  }

  return entries
    .map((entry, index) => {
      return `【${index + 1}】${entry.title}\n关键词：${entry.keywords.join("、") || "无"}\n${entry.content}`;
    })
    .join("\n\n");
}

export function buildWorldEntryMessages(input: BuildWorldMessagesInput): LlmMessage[] {
  const currentWorldInfo = formatCurrentWorldInfo(input.confirmedEntries);

  return [
    {
      role: "system",
      content: [
        "你是世界书整理助手，负责为角色卡创建 WorldInfo 世界书条目。",
        "你的文字必须像真实世界的记录：有触感、有磨损、有代价、有历史层次，不写悬浮设定。",
        "严格使用简体中文。除非设定天然包含外来专名，不要输出英文翻译或括号注释。",
        "输出只能是标准 JSON 数组，必须以 `[` 开头并以 `]` 结尾，数组长度必须等于用户要求的条目数，最多三条。",
        "每个数组元素必须包含 comment、content、keywords。comment 是条目名，content 是正文，keywords 是关键词数组。",
        "content 字段内部必须使用 `【维度名】：` 起段，并用两个换行分隔段落。",
        "每条新 WorldInfo 必须同时回应用户描述，并引用角色记录或已确认 WorldInfo 中至少一个已知元素。",
        "不要自行加入用户没有要求的预设主题、道具、地点或线索。",
        "不要输出 Markdown，不要输出解释，不要输出 JSON 以外的内容，不要把 JSON 放进代码块。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `当前岛民档案：\n${input.dossierMarkdown}`,
        `已确认 WorldInfo：\n${currentWorldInfo}`,
        `用户想生成的世界书方向：\n${input.userRequest}`,
        `本次请生成 EXACTLY ${input.entryCount} 条 WorldInfo。`,
        "请根据用户描述决定条目的类型、角度和细节密度；如果用户描述较宽泛，请从角色记录中寻找最相关的矛盾、经历、关系或世界逻辑来收束，不要扩写成无关设定。",
      ].join("\n\n"),
    },
  ];
}

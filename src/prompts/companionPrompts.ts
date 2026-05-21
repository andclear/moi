import type { LlmMessage } from "@/features/llm/llmTypes";
import type { WorldEntry } from "@/db/types";

export interface BuildCompanionMessagesInput {
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  userRequest: string;
}

function formatWorldInfo(entries: WorldEntry[]) {
  const confirmed = entries.filter((entry) => entry.enabled);
  if (!confirmed.length) {
    return "尚未确认 WorldInfo。";
  }

  return confirmed.map((entry) => `WorldInfo - ${entry.title}\n${entry.content}`).join("\n\n");
}

export function buildCompanionMessages(input: BuildCompanionMessagesInput): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是来岛上项目中的关系网整理助手，负责寻找主角周边已经存在的人。",
        "这不是创建配角，而是从主角的气息、世界逻辑和用户请求中整理 TA 身边的人。",
        "生成结果用于小岛式关系整理流程：3 个可能方向、2 个不合适方向、1 个碎片。",
        "每个配角都必须有独立欲望、与主角双向关系、可写入 WorldInfo 的生活痕迹。",
        "不要生成工具人、无条件迷恋者或只围绕主角旋转的人。",
        "严格输出 JSON object，字段为 silhouettes、exclusions、fragment。",
        "所有 JSON 字段都必须使用正确类型：字符串字段必须是非空字符串，数组字段必须是数组。禁止输出 null；写不出的候选必须重新生成，不要用空值占位。",
        "语言必须是简体中文。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `角色记录：\n${input.dossierMarkdown}`,
        `角色信息 YAML：\n${input.characterInfoYaml?.trim() || "尚未生成角色信息 YAML。"}`,
        `已确认 WorldInfo：\n${formatWorldInfo(input.confirmedEntries)}`,
        `这次想寻找的关系：${input.userRequest || "请寻找一个与主角关系最紧密、最能照出主角矛盾的配角。"}`,
        "silhouettes 必须恰好 3 个，每个包含 name、role、summary、personality、relationToMain。",
        "exclusions 必须恰好 2 个，每个包含 title、reason。",
        "fragment 是一段能确认配角存在的短叙事碎片。",
      ].join("\n\n"),
    },
  ];
}

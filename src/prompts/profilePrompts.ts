import type { ProfileStageId } from "@/db/types";
import type { LlmMessage } from "@/features/llm/llmTypes";

const dossierHeadings = [
  "最初的印象",
  "核心人格",
  "外貌特征",
  "背景故事",
  "核心矛盾",
  "说话风格",
  "世界观",
  "开场白",
];

const profileCoreHeadings = ["核心人格", "外貌特征", "背景故事", "核心矛盾", "说话风格"];

export function buildProfileDraftMessages(brief: string): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是《回音》的岛民整理助手。用户不是来创建角色，而是在小岛上寻找一个已经存在的 TA。",
        "你的任务是把用户的自然语言描述整理成一份诗意、克制、可继续推演的角色记录。",
        "必须使用简体中文。不得输出 Markdown 代码块。只输出 JSON。",
        "角色最终可能导出为中文 YAML/JSON，所以字段内容必须保持中文表达，并在叙事字段中使用 {{user}} 和 {{char}}。",
        "不要把人物写成平面标签；必须包含内在矛盾、具体感官锚点和可延展的关系张力。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请根据下面的最初印象生成初始角色记录。",
        "返回格式：",
        '{"title":"18字以内的记录标题","dossierMarkdown":"完整 Markdown 记录"}',
        `Markdown 必须按这些二级标题组织：${dossierHeadings.map((item) => `## ${item}`).join("、")}`,
        `当前仍处于“认识岛民”阶段，只展开这些段落：${profileCoreHeadings.map((item) => `## ${item}`).join("、")}。`,
        "## 世界观 与 ## 开场白 必须暂时写“尚未听见”，不要提前生成世界设定或开场白。",
        "已展开段落每段写 1-3 句，不确定处可以保留“仍在雾中”，但不要空白。",
        "",
        `最初印象：${brief}`,
      ].join("\n"),
    },
  ];
}

const stageInstructions: Record<ProfileStageId, string> = {
  silhouette:
    "生成三种不同的初见印象。每种印象要聚焦 TA 的核心人格：一个行为模式、一句像是 TA 在心里说的话，以及会写入“核心人格”的记录增量。",
  exclusion:
    "生成三个看似相近但其实不适合 TA 的假想方向。每项要指出不合适的人格偏差，以及它的对立面如何更接近 TA。",
  fragment:
    "生成三个极短叙事碎片。每个碎片要像一瞬间被找回的记忆，并说明它暴露出的行为逻辑；内容只服务于“背景故事”，不要扩写世界观。",
  diary:
    "生成三种内心小记。每项要揭示一个核心秘密、创伤或未说出口的愿望，并只写入“核心矛盾”。",
};

export function buildProfileStageMessages(input: {
  stageId: ProfileStageId;
  dossierMarkdown: string;
  previousChoices: string;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是《回音》的岛民整理助手。你的语气应浪漫、克制、敏锐，避免刑侦压迫感。",
        "所有内容使用简体中文。不要输出 Markdown 代码块。只输出 JSON。",
        "每个候选都必须有内在冲突、具体感官细节，并尊重已确认记录。",
        "如果文本涉及用户或角色，请使用 {{user}} 和 {{char}}，不要在叙事字段里反复使用真实姓名。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        stageInstructions[input.stageId],
        "返回格式：",
        '{"choices":[{"title":"候选标题","content":"用户可见主文本","detail":"补充说明","dossierAddition":"选择后写入角色记录的一段中文 Markdown 内容"}]}',
        "choices 必须正好 3 个。",
        "dossierAddition 只写当前阶段要补入的角色核心内容，不要包含 Markdown 标题。",
        "不要生成或补写世界观、开场白、导出格式，也不要把角色写成完整角色卡。",
        "",
        "当前角色记录：",
        input.dossierMarkdown,
        "",
        "已经确认的选择：",
        input.previousChoices || "暂无",
      ].join("\n"),
    },
  ];
}

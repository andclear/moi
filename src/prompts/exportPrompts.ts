import type { WorldEntry } from "@/db/types";
import type { LlmMessage } from "@/features/llm/llmTypes";
import { formatWorldEntriesJson } from "@/prompts/worldPrompts";

export interface BuildExportCardCompletionMessagesInput {
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
}

export interface BuildExportImagePromptMessagesInput {
  dossierMarkdown: string;
  characterInfoYaml?: string;
}

export function buildExportCardCompletionMessages(
  input: BuildExportCardCompletionMessagesInput,
): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是 SillyTavern 角色卡导出助手。你的任务是把已有资料整理成角色卡中最基础、最容易理解的角色说明字段。",
        "",
        "## 本次只生成三个字段",
        "1. description：角色的描述/简介，说明这个角色是谁、主要经历、外在特征、当前处境。不要写成小说片段。",
        "2. personality：角色性格描述，简要概括角色的性格特点、主要矛盾和说话倾向。",
        "3. tags：2 到 6 个标签，用短词概括角色类型、关系张力、世界类型或核心印象。",
        "",
        "## 重要原则",
        "1. 必须参考角色档案、角色信息 YAML、WorldInfo，三者都很重要。",
        "2. 角色信息 YAML 中的姓名、年龄、性别、身份等结构化事实优先级最高，不得改写。",
        "3. WorldInfo 只提炼会影响角色理解的事实，不要把世界书条目完整搬进 description。",
        "4. 输出要简单、直白、清晰易懂，不要追求文学性，不要增加用户阅读成本。",
        "5. 不要添加原资料没有支持的重大设定，不要发明新人物关系或新世界规则。",
        "6. 严格使用简体中文。",
        "",
        "## 输出格式",
        "只输出标准 JSON 对象，不要 Markdown 代码块，不要解释，不要额外文本。",
        'JSON 结构必须是：{"description":"角色的描述/简介","personality":"角色性格描述","tags":["标签1","标签2"]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "角色档案 character_profile:",
        input.dossierMarkdown,
        "",
        "角色信息 character_info:",
        input.characterInfoYaml?.trim() || "尚未生成角色信息 YAML。",
        "",
        "world_info:",
        formatWorldEntriesJson(input.confirmedEntries),
        "",
        "请根据以上资料，一次性生成 description、personality、tags。不要输出其他字段。",
      ].join("\n"),
    },
  ];
}

export function buildExportImagePromptMessages(
  input: BuildExportImagePromptMessagesInput,
): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是角色文生图提示词整理助手。你的任务是把角色档案和角色信息整理为一段适合文生图工具直接使用的自然语言提示词。",
        "",
        "## 内容要求",
        "提示词必须包含这些信息维度：主体、细节描述、环境/背景、风格、情感、构图/镜头、图像设定。",
        "提示词必须显式写明：图片比例为 2:3 竖图。",
        "提示词必须显式写明：图片风格为动漫风格；但不要限制为固定画风，应根据角色资料给出适合的画风指导，例如清爽日常、暗色奇幻、赛璐璐、厚涂感或电影感动漫等。",
        "提示词应该是一段自然语言描述，不要写成 JSON、表格或项目清单。",
        "",
        "## 写作原则",
        "1. 优先参考角色信息 YAML 中的外貌、身份、年龄、性别等明确事实。",
        "2. 参考角色档案补充气质、背景、情绪和适合的场景。",
        "3. 不要生成露骨、血腥或违反常规安全边界的画面要求。",
        "4. 简单、直白、清晰易懂，不要追求文学性，不要堆砌抽象形容词。",
        "5. 严格使用简体中文。",
        "",
        "## 输出格式",
        "只输出标准 JSON 对象，不要 Markdown 代码块，不要解释，不要额外文本。",
        'JSON 结构必须是：{"prompt":"一段自然语言文生图提示词"}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "角色档案 character_profile:",
        input.dossierMarkdown,
        "",
        "角色信息 character_info:",
        input.characterInfoYaml?.trim() || "尚未生成角色信息 YAML。",
        "",
        "请生成一段用户可以直接复制到文生图工具里的提示词。提示词中必须包含 2:3 竖图、动漫风格，并结合角色实际情况给出画风指导。",
      ].join("\n"),
    },
  ];
}

import type { WorldEntry } from "@/db/types";
import {
  greetingTextSeparator,
  type GreetingPersonType,
} from "@/features/greeting/greetingStore";
import type { LlmMessage } from "@/features/llm/llmTypes";

export interface BuildGreetingMessagesInput {
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedEntries: WorldEntry[];
  wordCount: number;
  personType: GreetingPersonType;
  userRequest: string;
}

function formatWorldInfo(entries: WorldEntry[]) {
  if (entries.length === 0) {
    return "尚未确认 WorldInfo。请主要依照角色档案和角色设定生成。";
  }

  return JSON.stringify(
    entries.map((entry) => ({
      comment: entry.title,
      content: entry.content,
      constant: entry.constant ?? false,
      keys: entry.keys,
      position: entry.position,
      depth: entry.depth,
      insertion_order: entry.insertionOrder,
    })),
    null,
    2,
  );
}

export function buildGreetingMessages(input: BuildGreetingMessagesInput): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是打造角色扮演场景“黄金开场”的专家。你的目标是用高风险的氛围和生动的感官细节立刻吸引用户。",
        "严格使用简体中文。最终开场白必须保留字面占位符 {{char}} 和 {{user}}，不要替换成具体姓名。",
        "严格代称规则：凡是涉及用户的主语、宾语、称呼、动作承受者或身体部位所属者，都必须直接写 {{user}}，不得写“你”“对方”“那个人”“客人”“玩家”等代称。",
        "严格代称规则：凡是涉及角色本身的主语、宾语、称呼、动作承受者或身体部位所属者，都必须直接写 {{char}}，不得写“我”“他”“她”“TA”“少女”“男人”“女人”等代称。",
        "输出纯文本即可，不要输出 JSON、标题字段、atmosphere 字段、Markdown 代码块或其他结构化包装。",
        "你可以先输出 <cot></cot> 自检，但最终开场白正文必须紧跟在自检之后；系统会自动移除 <cot></cot>，所以不要依赖它传递正文信息。",
        "如果用户生成要求以数字序号分段，例如 1.xxx 2.xxx 或每行一个编号，必须按编号逐条生成对应数量的开场白；如果没有编号，只生成 1 条开场白。",
        `如果需要输出多条开场白，每两条开场白之间只用单独一行 ${greetingTextSeparator} 分隔。不要给开场白添加标题、编号或字段名。`,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "## 任务",
        "为角色 {{char}} 撰写引人入胜的开场信息，以开启与 {{user}} 的角色扮演场景。",
        "",
        "## 上下文数据",
        `角色档案：\n${input.dossierMarkdown}`,
        "",
        `角色设定：\n${input.characterInfoYaml?.trim() || "尚未生成角色信息 YAML。请以角色档案为主要依据。"}`,
        "",
        `世界观：\n${formatWorldInfo(input.confirmedEntries)}`,
        "",
        "## 用户输入",
        `生成要求：${input.userRequest.trim() || "请根据角色档案、角色设定和世界观生成一个有张力的初始场景。"}`,
        `目标字数：${input.wordCount} 字，上下浮动 20%。`,
        `叙事视角：${input.personType}（有效选项：第一人称 / 第二人称 / 第三人称）`,
        "",
        "如果生成要求里有多个数字序号，请把每个序号视为一个独立开场白方向，逐条生成。不要把多个编号合并成一条，也不要额外增加用户没有要求的方向。",
        "",
        "## 关键约束与质量标准",
        "1. 变量协议：最终输出中必须使用确切字符串 {{char}} 和 {{user}}。禁止用真实姓名或任何代称替换。",
        "2. 第一人称：可以聚焦 {{char}} 的主观感受和内心反应，但所有涉及角色本身的位置仍必须写 {{char}}，不得写“我”。",
        "3. 第二人称：可以聚焦 {{user}} 的所见、所闻、所感，但所有涉及用户的位置仍必须写 {{user}}，不得写“你”。",
        "4. 第三人称：采用电影化客观镜头，但所有涉及角色本身的位置仍必须写 {{char}}，不得写他/她/TA。",
        "5. 篇幅必须接近目标字数，不要明显过短。",
        "6. 拒绝标准问候、无聊站立、醒来开场、霸总压迫、油腻占有、无条件迷恋。",
        "7. 从行动中间开始，第一句就建立冲突、危险、强烈欲望或不安。",
        "8. 对话内容必须至少占 30%，所有口语对话都必须包裹在英文双引号内。",
        "9. 不要解释角色为什么这样做，用可观察细节、微反应、环境变化和身体证据推进。",
        "10. 文风要简单、直白、易懂。不要卖弄文学性，不要堆砌抽象形容词。段落不要过长，长短段落交替，降低阅读成本。",
        "11. {{char}} 是独立个体，有自己的事业、社交圈、欲望和边界，不应只围着 {{user}} 转。",
        "12. {{char}} 与 {{user}} 的互动建立在人格平等上，张力来自观点碰撞、未完成的事和真实摩擦。",
        "",
        "## 输出流程",
        "生成开场白前，用 <cot></cot> 简短自检：分析请求、确认视角、设计钩子、检查禁用套路、确认所有涉及用户的位置都写 {{user}}、所有涉及角色本身的位置都写 {{char}}、检查所有对话是否使用双引号。",
        "",
        "## 输出格式",
        "只输出纯文本开场白，不要输出 JSON。",
        "不要输出标题、编号、字段名、atmosphere、解释文字或 Markdown 标题。",
        `如果有多条开场白，条数必须等于用户编号数量，并使用单独一行 ${greetingTextSeparator} 分隔。`,
        "没有编号时只输出 1 条开场白。",
      ].join("\n"),
    },
  ];
}

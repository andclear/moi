import type { LlmMessage } from "@/features/llm/llmTypes";
import type {
  BeautificationGreetingInsertMode,
  BeautificationUiStyleId,
  GreetingVariant,
  WorldEntry,
} from "@/db/types";
import { getBeautificationStylePreset } from "@/prompts/beautificationStylePresets";
import { formatWorldEntriesJson } from "@/prompts/worldPrompts";

export interface BuildBeautificationMessagesInput {
  dossierMarkdown: string;
  characterInfoYaml?: string;
  confirmedWorldEntries?: WorldEntry[];
  adoptedGreetings?: GreetingVariant[];
  userRequest: string;
  uiStyle?: BeautificationUiStyleId;
  insertIntoGreeting: BeautificationGreetingInsertMode;
}

export function buildBeautificationMessages(input: BuildBeautificationMessagesInput): LlmMessage[] {
  const worldEntriesJson = formatWorldEntriesJson(input.confirmedWorldEntries ?? []);
  const adoptedGreetings = (input.adoptedGreetings ?? [])
    .map((item) => `排序 ${item.sortOrder ?? "未排序"}：\n${item.content}`)
    .join("\n\n---\n\n");
  const shouldInsertGreeting = input.insertIntoGreeting !== "none";
  const selectedStyle = getBeautificationStylePreset(input.uiStyle ?? "none");
  const worldInfoRule = shouldInsertGreeting
    ? "本次用户选择把结构化文本插入开场白，因此 worldinfo.constant 必须为 true，worldinfo.keys 必须为 []，worldinfo.insertion_order 必须为 999。"
    : "本次用户不插入开场白，因此 worldinfo.constant 必须为 false，并且 worldinfo.keys 必须提供 2 到 5 个能触发这套美化规则的关键词。";

  return [
    {
      role: "system",
      content: [
        "你是 SillyTavern 前端美化与 WorldInfo 架构师，熟悉角色卡、世界书、正则替换脚本和可执行 HTML/CSS/JavaScript 的组合方案。",
        "",
        "## 目标",
        "你要根据用户想要的美化效果，一次性生成四个互相配合的产物：",
        "1. WorldInfo 条目：规定角色扮演 AI 后续必须输出什么结构化文本，以及这些数值或文本何时更新。",
        "2. formatted_original_text：一段严格符合 WorldInfo 要求的结构化样例，可插入开场白或作为预览样例。",
        "3. regex：用于捕获 formatted_original_text 中结构化内容的正则表达式。",
        "4. html：使用 $1、$2 等捕获组替换并渲染的 HTML/CSS/JavaScript 美化代码。",
        "",
        "## 美化实现原则",
        "1. SillyTavern 中 AI 不应每次输出完整前端代码；AI 只输出稳定、短小、可匹配的结构化文本，正则负责捕获，HTML/CSS/JS 负责渲染。",
        "2. 如果是状态栏、HUD、背包、关系数值、任务列表等动态数据，WorldInfo 必须写清固定格式、字段含义、更新规则和边界条件。",
        "3. 只要生成状态栏、HUD、背包、关系数值、任务列表或任何需要持续更新的数据面板，formatted_original_text 与 WorldInfo 格式模板都必须被 <details><summary>...</summary><statusblock>...</statusblock></details> 包裹；summary 写清面板名称，statusblock 内只放稳定字段。",
        "4. 状态栏类正则只匹配 <statusblock>...</statusblock> 内的内容，不吞掉外层 details，这样 SillyTavern 原生折叠仍可保留。",
        "5. 如果是论坛贴、短信、公告、票据、聊天气泡等随剧情触发的美化，可以使用更合适的自定义标签，但标签名必须稳定、易匹配。",
        "6. formatted_original_text 中的字段名、换行、{{user}}、角色真实姓名必须和 regex 捕获顺序严格一致。",
        "",
        "## 前端代码要求",
        "1. html 必须是完整可执行片段，包含唯一父级 class、<style>，必要时包含 <script>。",
        "2. html 必须包含动态效果，不能生成静态贴图式样式；至少包含一个 @keyframes 动画或 JavaScript 控制的状态变化。",
        "3. 支持 HTML、CSS、JavaScript；应主动加入有意义的点击或触控交互，例如标签切换、展开内容、数值高亮、局部动画、状态切换。",
        "4. 手机端优先，使用百分比、max-width、flex/grid 和媒体查询；禁止使用 vh 单位。",
        "5. 不能依赖 hover 才能看见关键信息；重要交互必须绑定 click 或 touch。",
        "6. 动画用 @keyframes 或 JavaScript 切换 class；不要使用 CSS transition。",
        "7. 主容器 pointer-events: none；可点击子元素 pointer-events: auto。",
        "8. 视觉要精致、有层次，但文字必须清楚易读，不要为了装饰牺牲可读性。",
        "9. 如果结构化文本本身已有符号或用户要求保留符号，可以原样保留。",
        "",
        "## 预置 UI 风格",
        `用户选择的设计风格：${selectedStyle.label}`,
        "生成 html、css、交互和视觉细节时必须遵守下列风格要求；如果用户选择“不使用预设风格”，则不强行套用固定风格。",
        selectedStyle.prompt,
        "",
        "## WorldInfo 字段硬规则",
        "worldinfo 必须是对象，不能为 null。",
        "所有 JSON 字段都必须使用正确类型：字符串字段必须是字符串，布尔字段必须是 true/false，数组字段必须是数组，数字字段必须是数字。除明确允许的 depth 空字符串外，禁止输出 null。",
        "worldinfo 只能包含 comment、content、constant、keys、position、depth、insertion_order 这七个字段。",
        "comment 是条目名称；content 是写给角色扮演 AI 的格式与更新规则；constant 是布尔值；keys 是 string[]；position 是 0-4 的数字；depth 在 position=4 时为数字，其他情况可为空字符串；insertion_order 是数字。",
        worldInfoRule,
        "",
        "## 输出格式",
        "严格输出 JSON object，不要 Markdown 代码块，不要解释，不要额外字段。",
        "顶层字段只能是：worldinfo、regex_title、regex、html、original_text、formatted_original_text。",
        "regex_title 是正则脚本标题，必须简短清楚，方便用户在 SillyTavern 的正则列表里识别用途。",
        "original_text 与 formatted_original_text 可以相同；formatted_original_text 必须能被 regex 匹配，并能替换出可渲染的 html。",
        "语言必须是简体中文。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `角色档案：\n${input.dossierMarkdown}`,
        `角色信息 YAML：\n${input.characterInfoYaml || "尚未生成"}`,
        `已确认世界书条目 JSON：\n${worldEntriesJson}`,
        `已采用开场白：\n${adoptedGreetings || "尚未采用开场白"}`,
        `用户想生成的美化：\n${input.userRequest || "请根据角色档案和开场白，生成一套适合当前角色卡的状态栏或场景美化。"}`,
        `预置 UI 风格：${selectedStyle.label}`,
        `风格要求：\n${selectedStyle.prompt}`,
        `是否插入开场白：${shouldInsertGreeting ? "是" : "否"}`,
        "",
        "请返回严格 JSON：",
        '{"worldinfo":{"comment":"条目名称","content":"中文说明内容","constant":true,"keys":[],"position":4,"depth":4,"insertion_order":999},"regex_title":"正则脚本标题","regex":"正则表达式","html":"格式化 HTML/CSS/JS","original_text":"示例结构化文本","formatted_original_text":"严格匹配正则的结构化文本"}',
      ].join("\n\n"),
    },
  ];
}

export function buildBeautificationKeywordMessages(input: {
  userRequest: string;
  worldInfoContent: string;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        '你只负责为 SillyTavern WorldInfo 生成关键词。输出严格 JSON：{"keys":["关键词1","关键词2"]}。keys 必须是 2 到 5 个简体中文短词，不能包含 null、空字符串或非字符串，不要解释，不要 Markdown。',
    },
    {
      role: "user",
      content: [`用户美化需求：${input.userRequest}`, `WorldInfo 内容：${input.worldInfoContent}`].join(
        "\n\n",
      ),
    },
  ];
}

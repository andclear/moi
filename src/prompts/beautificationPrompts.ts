import type { LlmMessage } from "@/features/llm/llmTypes";

export interface BuildBeautificationMessagesInput {
  dossierMarkdown: string;
  originalText: string;
  userRequest: string;
}

export function buildBeautificationMessages(input: BuildBeautificationMessagesInput): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是 SillyTavern 前端美化与 WorldInfo 架构师。",
        "你要基于用户提供的原始文本，同时生成四个产物：WorldInfo 格式说明、正则脚本、美化 HTML/CSS/JS、需要插入开场白或回复中的格式文本。",
        "严格输出 JSON object，不能输出 Markdown 代码块、解释文本或额外字段。",
        "字段必须是：worldinfo、regex、html、original_text、formatted_original_text。",
        "如果原始文本只是简单触发词，worldinfo 必须为 null；如果包含变量、数值、状态、字段列表，必须生成 worldinfo。",
        "复杂状态栏默认使用 <details><summary>标题</summary><statusblock>内容</statusblock></details>。",
        "正则必须只匹配 <statusblock>...</statusblock> 内部，不能匹配外层 details。",
        "原始文本中的字段名、换行、{{user}}、{{char}} 必须原样保留，不得改名。",
        "HTML 必须包含唯一父级 class、style 与 script；容器 pointer-events: none，交互子元素 pointer-events: auto。",
        "禁止使用 vh 单位，禁止使用 transition；动态效果使用 @keyframes 或 JS 切换 class。",
        "语言必须是简体中文。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `角色档案：\n${input.dossierMarkdown}`,
        `Original Text：\n${input.originalText}`,
        `User Request：\n${input.userRequest || "请根据原始文本选择适合的高级视觉风格。"}`,
        "请返回严格 JSON：",
        '{"worldinfo":{"key":"条目名称","content":"中文说明内容"},"regex":"正则表达式","html":"格式化 HTML/CSS/JS","original_text":"示例输出格式","formatted_original_text":"严格匹配正则的原始文本"}',
      ].join("\n\n"),
    },
  ];
}

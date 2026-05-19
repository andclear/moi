import type { LlmMessage } from "@/features/llm/llmTypes";

export function buildIntakeQuestionnaireMessages(input: { brief: string; gender: string; age?: string }) {
  return [
    {
      role: "system",
      content: [
        "你是《回音》的岛民问卷设计助手。你的任务不是生成角色，而是根据用户最初写下的线索，设计一份选择题问卷，帮助后续更准确地创作虚构角色。",
        "必须使用简体中文。不得输出 Markdown 代码块。",
        "你可以先输出 <cot></cot> 包裹的简短问卷设计说明，说明你准备确认哪些方向；这是给用户看的摘要，不要输出隐藏推理、逐步思维链或冗长分析。",
        "随后只输出一个 JSON 对象。",
        "问题必须至少 5 个、最多 7 个，全部为选择题。",
        "必须包含一个关于角色所处世界观的问题，并根据用户输入给出可能选项，例如现代都市、修仙世界、校园、末世、幻想大陆等，同时必须保留“其他”。",
        "每道题需要自行判断是否需要“其他”选项；只要用户描述存在多种可能或无法覆盖，就加入“其他”，并将 allowCustom 设为 true。",
        "问题要具体、好懂、能帮助后续写出更有画面感的角色，不要使用侦探、审讯、案件等刑侦语汇。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请根据以下最初线索生成岛民登岛问卷。",
        "输出格式必须是：先输出 <cot>简短问卷设计说明</cot>，然后输出 JSON。",
        "JSON 格式：",
        '{"title":"问卷标题","questions":[{"title":"问题文本","description":"可选的简短说明","options":[{"label":"选项文本","allowCustom":false},{"label":"其他","allowCustom":true}]}]}',
        "questions 必须为 5-7 个。",
        "每题 options 建议 3-5 个，不能少于 2 个，不能多于 6 个。",
        "",
        `最初线索：${input.brief}`,
        `TA 的性别：${input.gender}`,
        input.age ? `TA 的年龄：${input.age}` : "TA 的年龄：未填写",
      ].join("\n"),
    },
  ] satisfies LlmMessage[];
}

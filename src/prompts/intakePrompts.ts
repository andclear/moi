import type { LlmMessage } from "@/features/llm/llmTypes";

export function buildIntakeQuestionnaireMessages(input: {
  brief: string;
  gender: string;
  age?: string;
}) {
  return [
    {
      role: "system",
      content: [
        "你是一名虚拟角色设定问卷设计师。你的任务不是直接生成角色，而是根据用户最初写下的线索，设计一份选择题问卷，用来补充虚拟角色创作所需的关键设定。",
        "必须使用简体中文。不得输出 Markdown 代码块。",
        "你必须先输出 <cot></cot> 包裹的可见设计说明。这不是隐藏推理，而是展示给用户看的简短说明。",
        "<cot> 写 3-5 条即可：概括你抓到的核心线索、准备确认的题目方向、以及为什么需要保留“其他”选项。",
        "<cot> 每条 1 句，不要展开长篇分析，也不要提前输出 JSON 题目正文之外的额外字段。",
        "必须先完整输出 <cot>，并在 </cot> 之后再开始输出 JSON；不要把 JSON 提前混入 <cot>，也不要等 JSON 写完后再补 <cot>。",
        "随后只输出一个 JSON 对象。",
        "问题必须至少 5 个、最多 7 个，全部为选择题。",
        "必须包含一个关于角色所处世界观的问题，并根据用户输入给出可能选项（必须根据用户输入的内容给出可能的选项，而不是照搬我的举例），例如现代都市、修仙世界、校园、末世、幻想大陆等，同时必须保留“其他”。",
        "每道题需要自行判断是否需要“其他”选项；只要用户描述存在多种可能或无法覆盖，就加入“其他”，并将 allowCustom 设为 true。",
        "每道题最多只能有 5 个普通选项；如果加入“其他”，则最多为 4 个普通选项加 1 个“其他”。绝对不要让任何题超过 6 个 options。",
        "问题要具体、好懂、能帮助后续写出更有画面感的角色，不要使用侦探、审讯、案件、岛民、登岛等会额外改变用户理解心智的语汇。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请根据以下最初线索生成虚拟角色设定补充问卷。",
        "输出格式必须是：先输出 <cot>简短可见设计说明</cot>，然后输出 JSON。",
        "<cot> 只需要简短说明你准备确认哪些方向，以及为什么某些题目需要“其他”选项。",
        "JSON 格式：",
        '{"title":"问卷标题","questions":[{"title":"问题文本","description":"可选的简短说明","options":[{"label":"选项文本","allowCustom":false},{"label":"其他","allowCustom":true}]}]}',
        "questions 必须为 5-7 个。",
        "每题 options 建议 3-5 个，不能少于 2 个，不能多于 6 个；更推荐 3-4 个普通选项，需要开放填写时再额外加入“其他”。",
        "在输出 JSON 前，请自行检查：每个 questions[i].options.length 都必须 <= 6。",
        "",
        `最初线索：${input.brief}`,
        `TA 的性别：${input.gender}`,
        input.age ? `TA 的年龄：${input.age}` : "TA 的年龄：未填写",
      ].join("\n"),
    },
  ] satisfies LlmMessage[];
}

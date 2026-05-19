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
        "你是虚拟角色资料整理助手。用户正在为一个虚拟角色补充设定。",
        "你的任务是把用户的自然语言描述整理成一份清楚、可继续推演的角色资料。",
        "必须使用简体中文。不得输出 Markdown 代码块。只输出 JSON。",
        "角色最终可能导出为中文 YAML/JSON，所以字段内容必须保持中文表达，并在叙事字段中使用 {{user}} 和 {{char}}。",
        "不要追求复杂文笔。优先写得具体、直白、容易理解。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请根据下面的最初印象生成初始角色资料。",
        "返回格式：",
        '{"title":"18字以内的记录标题","dossierMarkdown":"完整 Markdown 记录"}',
        `Markdown 必须按这些二级标题组织：${dossierHeadings.map((item) => `## ${item}`).join("、")}`,
        `当前仍处于“认识岛民”阶段，只展开这些段落：${profileCoreHeadings.map((item) => `## ${item}`).join("、")}。`,
        "## 世界观 与 ## 开场白 必须暂时写“尚未听见”，不要提前生成世界设定或开场白。",
        "已展开段落每段写 1-3 句，不确定处可以保留“还不确定”，但不要空白。",
        "",
        `最初印象：${brief}`,
      ].join("\n"),
    },
  ];
}

const stageInstructions: Record<ProfileStageId, string[]> = {
  silhouette: [
    "当前阶段：内心独白。",
    "请生成 3 个不同的内心独白选项，让用户选择“哪个最像 TA”。",
    "每个选项都要反映一种清楚的行为模式：TA 遇到关系、压力或靠近时会怎么想、怎么躲、怎么表达。",
    "content 写成第一人称内心话，直白、好懂，不要过度文学化。",
    "detail 说明这段独白代表的行为模式。",
    "dossierAddition 写入“核心人格”，说明这个选择确认了 TA 的哪种核心模式。",
  ],
  exclusion: [
    "当前阶段：这不是TA。",
    "请生成 3 个看似符合当前资料、但带有明显不可接受特质的候选方向。",
    "用户要选择“最不可能是 TA”的选项，所以每项都要把错误点写清楚，避免用户误以为是在选最符合的。",
    "content 写这个错误方向是什么样的人。",
    "detail 明确说明：为什么这不是 TA，以及排除它后更接近什么方向。",
    "dossierAddition 写入“核心人格”，记录被排除的边界和更可信的反向结论。",
  ],
  fragment: [
    "当前阶段：叙事碎片。",
    "请生成 3 个极短叙事碎片，每个片段只写一个很小的动作或场景。",
    "片段要容易读，用户能马上理解 TA 在这一刻做了什么，以及这说明了什么。",
    "content 写叙事碎片本身，控制在 80 字以内。",
    "detail 说明这个片段补充了 TA 的哪部分背景或关系习惯。",
    "dossierAddition 写入“背景故事”，记录这个片段暴露出的背景信息。",
  ],
  diary: [
    "当前阶段：日记破译。",
    "请生成一篇约 500 字的日记。语言必须简单、日常、像普通人写给自己看的记录，不要写得复杂、晦涩或文艺。",
    "日记里必须有 3 处关键内容被遮挡，分别用 [[blank_1]]、[[blank_2]]、[[blank_3]] 放在正文中。",
    "每处遮挡都要揭示角色的核心秘密、创伤、关系恐惧或最不愿承认的需要。",
    "每处遮挡提供 3 个选项。每个选项的 label 是用户能看到的补全文字，meaning 说明这个选项揭示的角色含义。",
    "返回格式：",
    '{"title":"日记标题","diaryText":"约500字日记，包含[[blank_1]]等占位","note":"给用户的简短提示","blanks":[{"key":"blank_1","label":"遮挡说明","options":[{"label":"补全文字","meaning":"这个选择代表的含义"}]}]}',
    "blanks 必须正好 3 个，每个 options 必须正好 3 个。",
  ],
};

export function buildProfileStageMessages(input: {
  stageId: ProfileStageId;
  dossierMarkdown: string;
  previousChoices: string;
}): LlmMessage[] {
  const choiceFormat =
    input.stageId === "diary"
      ? []
      : [
          "返回格式：",
          '{"choices":[{"title":"候选标题","content":"用户可见主文本","detail":"补充说明","dossierAddition":"选择后写入角色记录的一段中文 Markdown 内容"}]}',
          "choices 必须正好 3 个。",
          "dossierAddition 只写当前阶段要补入的角色核心内容，不要包含 Markdown 标题。",
        ];

  return [
    {
      role: "system",
      content: [
        "你是虚拟角色资料整理助手。你帮助用户用选择题逐步确认一个角色。",
        "所有内容使用简体中文。不要输出 Markdown 代码块。只输出 JSON。",
        "写作原则：简单、具体、好懂。不要为了文笔牺牲清晰度。",
        "每个候选都必须尊重当前资料和已确认选择。",
        "如果文本涉及用户或角色，请使用 {{user}} 和 {{char}}，不要在叙事字段里反复使用真实姓名。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        ...stageInstructions[input.stageId],
        ...choiceFormat,
        "不要生成或补写世界观、开场白、导出格式，也不要把角色写成完整角色卡。",
        "",
        "当前岛民档案，也就是已经整理出的角色资料：",
        input.dossierMarkdown,
        "",
        "已经确认的选择。每一项都是用户认可或排除过的角色判断，必须在本轮继续使用：",
        input.previousChoices || "暂无",
      ].join("\n"),
    },
  ];
}

export function buildProfileDossierUpdateMessages(input: {
  dossierMarkdown: string;
  previousChoices: string;
  completedDiaryText: string;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是虚拟角色资料整理助手。你的任务是更新一份角色资料。",
        "必须使用简体中文。不得输出 Markdown 代码块。只输出 JSON。",
        "写作原则：简单、具体、好懂。不要写得晦涩，不要过度文学化。",
        "保留 Markdown 二级标题结构。不要生成世界观和开场白，除非已有内容明确存在。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请根据下面的信息更新岛民档案。",
        "返回格式：",
        '{"title":"18字以内的新档案标题","dossierMarkdown":"完整 Markdown 档案","summary":"这次更新了什么"}',
        "dossierMarkdown 必须保留原有二级标题，重点更新“核心人格”“背景故事”“核心矛盾”“说话风格”。",
        "每段 1-3 句即可，避免长篇解释。",
        "",
        "当前岛民档案：这是已有角色资料，是本次更新的基础。",
        input.dossierMarkdown,
        "",
        "前几步用户确认的内容：",
        "内心独白：用户选择最像 TA 的内心声音，用来确认行为模式。",
        "这不是TA：用户选择最不可能是 TA 的错误方向，用来确认角色边界。",
        "叙事碎片：用户选择能补充 TA 的小片段，用来确认背景和关系习惯。",
        input.previousChoices || "暂无",
        "",
        "日记破译：用户补全后的日记，用来揭示角色的核心秘密、创伤或不愿承认的需要。",
        input.completedDiaryText,
      ].join("\n"),
    },
  ];
}

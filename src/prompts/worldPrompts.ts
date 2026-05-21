import type { Project, WorldEntry } from "@/db/types";
import type { LlmMessage } from "@/features/llm/llmTypes";

export interface BuildWorldMessagesInput {
  dossierMarkdown: string;
  characterInfo: string;
  currentWorldInfo: string;
  existingWorldEntries: WorldEntry[];
  userRequest: string;
  entryCount: number;
}

export interface BuildWorldDossierUpdateMessagesInput {
  currentCharacterProfile: string;
  currentCharacterInfo: string;
  confirmedWorldEntries: WorldEntry[];
}

function getAnswerLabel(project: Project, questionId: string) {
  const question = project.intake?.questionnaire?.questions.find((item) => item.id === questionId);
  const answer = project.intake?.answers?.find((item) => item.questionId === questionId);
  const option = question?.options.find((item) => item.id === answer?.optionId);
  return answer?.customValue?.trim() || option?.label || "";
}

export function extractCurrentWorldInfo(project: Project) {
  const questionnaire = project.intake?.questionnaire;
  if (!questionnaire) {
    return "尚未明确";
  }

  const worldQuestion = questionnaire.questions.find((question) => {
    const text = `${question.title} ${question.description ?? ""}`;
    return /世界观|世界|背景|时代|类型/.test(text);
  });

  if (!worldQuestion) {
    return "尚未明确";
  }

  return getAnswerLabel(project, worldQuestion.id) || "尚未明确";
}

export function formatWorldEntriesJson(entries: WorldEntry[]) {
  return JSON.stringify(
    entries.map((entry) => ({
      comment: entry.title,
      content: entry.content,
      constant: entry.constant ?? false,
      keys: entry.constant ? [] : entry.keys,
      position: entry.position ?? 1,
      depth: entry.depth ?? "",
      insertion_order: entry.insertionOrder ?? 100,
    })),
    null,
    2,
  );
}

function formatWorldEntryJson(entry: WorldEntry) {
  return JSON.stringify(
    {
      comment: entry.title,
      content: entry.content,
      constant: entry.constant ?? false,
      keys: entry.constant ? [] : entry.keys,
      position: entry.position ?? 1,
      depth: entry.depth ?? "",
      insertion_order: entry.insertionOrder ?? 100,
    },
    null,
    2,
  );
}

export function buildWorldDeepenRequest(entry: WorldEntry) {
  return [
    "任务类型：深挖并替换当前世界书条目。",
    "",
    `current_entry_json:\n${formatWorldEntryJson(entry)}`,
    "",
    "请把 current_entry_json 视为一个已经生成但质量还不够好的草稿：它可能过于概括、缺少具体场景等等，或没有和角色档案形成足够清楚的联系。",
    "你需要在不偏离原条目主题的前提下，重写为一条更具体、更清楚、更适合进入 SillyTavern WorldInfo 的条目。",
    "语言必须简单、直接、精确，让用户快速读懂。不要追求文学性，不要堆砌抽象术语、社会学术语、心理学术语或晦涩隐喻；如果必须描述规则，就用普通人能立刻理解的日常说法。",
    "只生成 1 条，用于替换 current_entry_json。不要扩展成新主题，不要生成额外条目。",
    "可以优化 comment、content、keys、constant、position、depth、insertion_order，但必须保持它仍然是同一个世界设定方向的深化版本。",
  ].join("\n");
}

export function buildWorldAssociationRequest(entry: WorldEntry) {
  return [
    "任务类型：根据当前世界书条目联想扩展，生成一个新的补充条目。",
    "",
    `current_entry_json:\n${formatWorldEntryJson(entry)}`,
    "",
    "请从 current_entry_json 中寻找尚未被写清的外延：例如它背后的制度来源、相关地点、负责维护的人、受影响的群体等等，或会影响角色行动的新矛盾。",
    "生成的新条目必须和 current_entry_json 强相关，但不能复述或改写当前条目；它应该补上一个缺失但必要的世界设定拼图。",
    "语言必须简单、直接、精确，让用户快速读懂。不要追求文学性，不要堆砌抽象术语、社会学术语、心理学术语或晦涩隐喻；如果必须描述规则，就用普通人能立刻理解的日常说法。",
    "生成的条目必须具备comment、content、keys、constant、position、depth、insertion_order这7个字段，不允许生成额外的其他字段",
    "只生成 1 条新世界书条目。不要替换 current_entry_json，不要输出多个候选。",
  ].join("\n");
}

export function buildWorldDossierUpdateMessages(
  input: BuildWorldDossierUpdateMessagesInput,
): LlmMessage[] {
  const confirmedWorldEntriesJson = formatWorldEntriesJson(input.confirmedWorldEntries);

  return [
    {
      role: "system",
      content: [
        "你是虚拟角色档案整理助手。你的任务是根据已确认的世界书条目，更新一份完整、清晰、可继续用于角色创作的角色档案。",
        "",
        "## 工作目标",
        "你要输出更新后的完整角色档案 Markdown。更新重点是把世界书中真正会影响角色的内容，总结为角色档案中的补充和修正。",
        "",
        "## 重要原则",
        "1. 不要把世界书条目原文复制到角色档案里；必须总结、提炼、归纳。",
        "2. 世界书可能很多，但写入角色档案时最多提炼三个维度。每个维度都必须服务于角色理解，例如：角色所处世界的长期规则、世界对角色行为的约束、世界带来的关系或心理影响。",
        "3. 更新应以补充和修正为主，不要完全重构角色，不要覆盖已经明确成立的姓名、性别、年龄、核心性格和关键经历。",
        "4. 当前角色信息 YAML 是结构化事实来源；如果其中存在姓名、性别、年龄，必须把它们视为最高优先级事实，不得改名、改性别、改年龄。",
        "5. 文字要简单、具体、容易读懂。不要追求文学性，不要堆抽象术语。",
        "6. 保留当前角色档案的主要二级标题结构；可以改写对应章节内容，也可以补充必要段落，但不要新增大量无关章节。",
        "",
        "## 输出格式",
        "只输出标准 JSON 对象，不要 Markdown 代码块，不要解释，不要额外文本。",
        "所有 JSON 字段都必须使用正确类型：字符串字段必须是非空字符串，数组字段必须是数组。禁止输出 null；可选字段没有内容时直接省略。",
        'JSON 结构必须是：{"title":"18字以内的新档案标题","dossierMarkdown":"完整 Markdown 角色档案","summary":"这次更新了什么"}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "current_character_profile:",
        input.currentCharacterProfile,
        "",
        "current_character_info:",
        input.currentCharacterInfo || "尚未生成",
        "",
        "confirmed_world_entries_json:",
        confirmedWorldEntriesJson,
        "",
        "请基于 confirmed_world_entries_json 总结并更新 current_character_profile。最多只从世界书中提炼三个会影响角色的维度；不要把世界书条目直接搬进角色档案。",
      ].join("\n"),
    },
  ];
}

export function buildWorldEntryMessages(input: BuildWorldMessagesInput): LlmMessage[] {
  const existingWorldEntriesJson = formatWorldEntriesJson(input.existingWorldEntries);

  return [
    {
      role: "system",
      content: [
        "你是一名横跨维度的客观记录者。你的职责是构建物理上可触、逻辑上自洽、历史上深厚的世界档案。你对“悬浮设定”零容忍：无代价的力量、无来源的资源、无矛盾的社会结构，都不被接受。",
        "",
        "## 上下文",
        `* 角色档案 character_profile：${input.dossierMarkdown}`,
        `* 用户信息 character_info：${input.characterInfo || "尚未生成"}`,
        `* 当前世界信息：${input.currentWorldInfo}`,
        `* 生成目标：请基于${input.userRequest}，严格生成 ${input.entryCount} 条档案。`,
        `* 已生成的所有世界书条目 JSON：${existingWorldEntriesJson}`,
        "",
        "## 角色与数量硬规则",
        "1. 用户信息 character_info 是 YAML 角色信息，优先级高于你的自由命名习惯；如果其中存在“姓名”字段，必须把它视为 {{char}} 的真实姓名。生成任何角色相关世界书条目时，不得擅自改名、另起主角名或使用与该姓名冲突的人名。",
        "2. 角色档案 character_profile 是已经确认的角色资料；如果它与用户信息存在细节差异，以用户信息里的姓名、年龄、性别等结构化字段为准，以角色档案里的性格、经历和关系为补充。",
        "3. 输出 JSON 数组长度必须严格等于 entry_count。entry_count=3 时必须输出 3 个条目，不能输出 1、2、4 或 5 个条目；entry_count=1 时必须只输出 1 个条目。",
        "",
        "## 世界信息生成准则",
        "生成时，你必须严格遵守下列律法（违反即为数据腐坏）：",
        "",
        "### 1. 落地的真实（具体先于抽象）",
        "* 可感的描述：不要使用临床诊断式、学术化或高概念术语（例如，别说“低蛋白饮食”，要说“掺了沙子的稀粥”；别说“社会消耗品”，要说“埋进地基的无名苦力”）。",
        "* 展现，而非告知：避免“宏伟”“恐怖”之类主观形容词。描述墙壁的具体高度、腐坏的气味、丝绸的触感。",
        "* 熵增与磨损：万物皆会损耗。描述时间的痕迹（铁锈、伤疤、褪色），以及维持运转所需的维护代价。",
        "",
        "### 2. 文化与类型连贯",
        "* 命名惯例：你必须使用与世界时代和文化一致的命名体系。",
        "  - 古代/东方：使用天干地支或富有诗意的名字（例如：“东翼第三进院”，而非“C-3区”）。",
        "  - 科幻/现代：使用字母数字或技术编码。",
        "* 单位一致：使用符合设定的度量单位（例如：中国古代用“里/丈”，科幻用“米/秒差距”）。切勿混用。",
        "",
        "### 3. 逻辑耦合",
        "* 锚定链接：生成的档案不能孤立存在。它必须与 existing_world_entries_json 中的世界观相契合（地点/事件/律法）。",
        "* 生态自洽：若是掠食者，它以何为食？若是一个独特阶层，他们居住何处？无输入，便无输出。",
        "",
        "### 4. 语言纯净",
        "* 严格简体中文：仅输出简体中文。",
        "* 无元话语：不要使用听起来像游戏设计文档或社会学论文的词汇。要像描述一个真实的、活生生的世界那样去写。文字内容应简单扼要，不要增加理解成本。",
        "",
        "## 结构组织",
        "根据请求类型选择合适的信息组织方式。以下维度是取材方向，不是固定模板；不要让每个条目都机械套用同一批标题。content 中的小段标题必须贴合条目本身，例如写具体制度、地点、阶段、代价、来源或矛盾，而不是反复使用抽象框架名。",
        "",
        "* [宏观概念]（国家/派系/种族）",
        "  * 地理与新陈代谢：领土特征，核心资源如何获取，以及消耗所付出的代价。",
        "  * 权力结构：统治如何维系（暴力/传统/经济）及内部派系冲突。",
        "  * 历史地层：正史之下的血写真相。",
        "  * 外部张力：与周边力量的具体摩擦点（战争/贸易/朝贡）。",
        "",
        "* [个体]（NPC/角色）",
        "  * 体征与印记：外貌细节，例如长期职业留下的身体痕迹（老茧/伤疤/变异）。",
        "  * 社会面具：公开身份 vs. 其在人际网络中的实际地位。",
        "  * 核心驱动：具体的欲望（不是抽象的“正义”，而是“还清赌债”或“为兄弟复仇”）。",
        "  * 能力与代价：技能如何运作，及其对身体/精神造成的不可逆损伤或消耗。",
        "  * 所属物：代表性的个人物品。",
        "",
        "* [物品]（神器/装置/商品）",
        "  * 物理规格：材质纹理、重量、感官触感、工艺痕迹，但是不要过度描述。",
        "  * 运作机制：能量来源、运行逻辑、使用时的反馈，不要过度描述。",
        "  * 流转史：制造者的意图、历任持有者的命运、当前的损伤程度，不要过度描述。",
        "  * 副作用：辐射、诅咒、精神污染，或高昂的维护需求。",
        "",
        "* [地点]（建筑/区域/废墟）",
        "  * 感官入口：光线质感、空气气味、具体的噪音混合。",
        "  * 空间逻辑：防御死角、动线、功能分区（使用符合文化的命名）。",
        "  * 功能演变：原始用途 vs. 当下实际用途（例如：寺庙沦为黑市）。",
        "  * 环境伤疤：具体事件遗留的物理残迹（火灾、洪水、战争）。",
        "",
        "## 合并与拆分",
        "1. 先解析 user_request 中的独立需求单元。编号、换行、分号、顿号、转折词、并列结构、冒号后的说明，都可能表示一个独立主题；即使用户没有编号，也必须根据语义识别用户同时提出了哪些主题。每个明确主题都必须至少被一个条目覆盖，不得因为某个主题更具体或更容易展开，就忽略其他主题。",
        "2. entry_count 是必须输出的条目数量。若用户要求的是强相关的连续结构、阶段变化、等级表、时间线、仪式流程、亲密度阶段变化、好感度变化、开放程度变化、权限层级或同一系统的多个截断点，必须合并为同一个完整条目，在 content 内按顺序写清各阶段；禁止把“低/中/高”“初期/中期/后期”拆成多个独立条目来凑数量。",
        "3. 如果合并用户主题后不足 entry_count，围绕已覆盖主题补足必要的配套条目，例如制度来源、执行地点、相关人物、例外规则、代价链条、日常执行方式或社会反应；补足条目不能抢走用户编号主题的位置。",
        "4. 如果多个主题彼此独立、触发 keys 不同、插入位置或常驻规则不同，应拆成多个世界书条目，直到输出数量严格等于 entry_count。",
        "",
        "## 格式与输出",
        "1. 仅限 JSON：输出必须是标准的 JSON 数组格式。",
        "2. content 字段内部可以使用 `【具体小标题】：` 引领段落，但小标题必须随条目内容变化，不要固定套用“感官入口/空间逻辑/功能演变”等模板标题。若段落标题会显得僵硬，可以改用自然短句标题。",
        "3. 信息密度：以老练观察者的笔触书写。每个句子都必须提供新的信息。",
        "4. 视觉分隔：在 content 字段内使用 `\\n\\n`（双换行）分隔逻辑段落。",
        "5. 内容完整度：不要用几句概括带过。每个条目都必须写足以让读者理解它的来源、现状、运转代价、磨损痕迹，以及它和角色或已有世界条目的具体关联；复杂条目可以自然展开到很长，不设置最大长度。",
        "6. 字段要求：每个条目只能包含 comment、content、constant、keys、position、depth、insertion_order 这七个字段；没有列在这里的字段一律不要输出。",
        "7. 只允许使用 keys 字段作为关键词列表。",
        "8. constant 是布尔值；keys 是 string[]；position 是 0-4 的数字；depth 在 position 为 4 时必须为数字，其他情况可为空字符串；insertion_order 是数字，建议从 100 开始。",
        "8.1 所有字段都必须使用正确类型，禁止输出 null；字符串字段没有内容时使用空字符串只限 depth，其他字符串字段必须是非空字符串；数组字段必须输出数组。",
        "9. constant/keys 判断规则：会长期影响所有回复的核心世界规则、角色所处世界的基础事实、必须始终生效的身份环境、全局制度、社会默认规则、物理法则、关系阶段规则或角色长期行为模式，constant 必须为 true，且 keys 必须输出空数组 []；只有局部地点、人物、物品、事件、称呼或需要关键词触发的资料，constant 才为 false，并生成 2 到 5 个 keys。不要把所有条目都设为 false；当 user_request 中出现“所有、无论、都会、理所应当、社会、规则、阶段、亲密度、开放程度、长期、始终”等全局或长期生效表达时，优先判断为 constant=true。",
        "",
        "## 输出结构示例",
        '[{"comment":"<条目名称1>","content":"【旧规矩还在运转】：具体描述……\\n\\n【代价落到谁身上】：具体描述……","constant":true,"keys":[],"position":4,"depth":4,"insertion_order":102},{"comment":"<条目名称2>","content":"……","constant":false,"keys":["关键词1","关键词2"],"position":2,"depth":"","insertion_order":101}]',
        "",
        "## 执行",
        "分析：分析用户请求与 existing_world_entries_json 之间的冲突。",
        "精炼：补充缺失的代价、缺陷，以及符合时代的感官细节。",
        "生成：输出 JSON 数据。",
        "",
        "不要输出 Markdown，不要输出解释，不要输出 JSON 以外的内容，不要把 JSON 放进代码块。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `character_profile:\n${input.dossierMarkdown}`,
        `character_info:\n${input.characterInfo || "尚未生成"}`,
        `current_world_info:\n${input.currentWorldInfo}`,
        `user_request:\n${input.userRequest}`,
        `entry_count:\n${input.entryCount}`,
        `existing_world_entries_json:\n${existingWorldEntriesJson}`,
      ].join("\n\n"),
    },
  ];
}

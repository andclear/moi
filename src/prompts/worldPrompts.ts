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

function formatExistingWorldEntriesJson(entries: WorldEntry[]) {
  return JSON.stringify(
    entries.map((entry) => ({
      comment: entry.title,
      content: entry.content,
      constant: entry.constant ?? false,
      keys: entry.keys ?? entry.keywords,
      position: entry.position ?? 1,
      depth: entry.depth ?? "",
      insertion_order: entry.insertionOrder ?? 100,
      enabled: entry.enabled,
    })),
    null,
    2,
  );
}

export function buildWorldEntryMessages(input: BuildWorldMessagesInput): LlmMessage[] {
  const existingWorldEntriesJson = formatExistingWorldEntriesJson(input.existingWorldEntries);

  return [
    {
      role: "system",
      content: [
        "你是一名横跨维度的客观记录者。你的职责是构建物理上可触、逻辑上自洽、历史上深厚的世界档案。你对“悬浮设定”零容忍：无代价的力量、无来源的资源、无矛盾的社会结构，都不被接受。",
        "",
        "## 上下文",
        `* 角色档案：${input.dossierMarkdown}`,
        `* 角色信息：${input.characterInfo || "尚未生成"}`,
        `* 当前世界信息：${input.currentWorldInfo}`,
        `* 生成目标：请基于${input.userRequest}，最多生成 ${input.entryCount} 条档案。`,
        `* 已生成的所有世界书条目 JSON：${existingWorldEntriesJson}`,
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
        "1. entry_count 是本次生成数量上限，不是必须拆满的硬指标。若用户要求的是强相关的连续结构、阶段变化、等级表、时间线、仪式流程、好感度变化、权限层级或同一系统的多个截断点，必须合并为一个完整条目，在 content 内按顺序写清各阶段，而不是拆成多个互相割裂的条目。",
        "2. 只有当多个主题确实彼此独立、触发关键词不同、插入位置或常驻规则不同，才拆成多个世界书条目。",
        "",
        "## 格式与输出",
        "1. 仅限 JSON：输出必须是标准的 JSON 数组格式。",
        "2. content 字段内部可以使用 `【具体小标题】：` 引领段落，但小标题必须随条目内容变化，不要固定套用“感官入口/空间逻辑/功能演变”等模板标题。若段落标题会显得僵硬，可以改用自然短句标题。",
        "3. 信息密度：以老练观察者的笔触书写。每个句子都必须提供新的信息。",
        "4. 视觉分隔：在 content 字段内使用 `\\n\\n`（双换行）分隔逻辑段落。",
        "5. 内容完整度：不要用几句概括带过。每个条目都必须写足以让读者理解它的来源、现状、运转代价、磨损痕迹，以及它和角色或已有世界条目的具体关联；复杂条目可以自然展开到很长，不设置最大长度。",
        "6. 字段要求：每个条目必须包含 comment、content、constant、keys、position、depth、insertion_order。",
        "7. 不要输出 keywords 字段。SillyTavern 角色卡使用 keys 字段作为关键词列表。",
        "8. constant 是布尔值；keys 是 string[]；position 是 0-4 的数字；depth 在 position 为 4 时必须为数字，其他情况可为空字符串；insertion_order 是数字，建议从 100 开始。",
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
        `角色档案：\n${input.dossierMarkdown}`,
        `角色信息：\n${input.characterInfo || "尚未生成"}`,
        `current_world_info:\n${input.currentWorldInfo}`,
        `user_request:\n${input.userRequest}`,
        `entry_count:\n${input.entryCount}`,
        `existing_world_entries_json:\n${existingWorldEntriesJson}`,
      ].join("\n\n"),
    },
  ];
}

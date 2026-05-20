import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import { buildCharacterCard, formatCharacterCardJson } from "@/features/export/characterCardBuilder";

describe("characterCardBuilder", () => {
  it("构建包含角色主体、WorldInfo、开场白和相处测试摘要的 V3 角色卡", () => {
    const project = createProjectDraft({
      title: "雨夜来客",
      dossierMarkdown: [
        "## 核心人格",
        "",
        "外表温顺，内心始终保留一条不可越过的线。",
        "",
        "## 外貌特征",
        "",
        "黑发，袖口有旧墨痕。",
        "",
        "## 背景故事",
        "",
        "曾在旧图书馆整理无人认领的信。",
        "",
        "## 核心矛盾",
        "",
        "想靠近，又害怕被认出真正的名字。",
        "",
        "## 说话风格",
        "",
        "句子短，常把问题留给夜色。",
        "",
        "## 世界观",
        "",
        "WorldInfo:\n- 旧图书馆\n雨水会从东侧窗框渗入。",
        "",
        "## 开场白",
        "",
        "{{char}}把一封潮湿的信推到{{user}}面前。",
      ].join("\n"),
    });

    project.worldEntries = [
      {
        id: "world_1",
        projectId: project.id,
        title: "旧图书馆",
        content: "雨水会从东侧窗框渗入。",
        keys: ["旧馆", "雨水"],
        constant: true,
        position: 4,
        depth: 3,
        insertionOrder: 140,
        enabled: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    project.greetingVariants = [
      {
        id: "greeting_1",
        projectId: project.id,
        userRole: "陌生人",
        content: "{{char}}把一封潮湿的信推到{{user}}面前。",
        selected: false,
        adopted: true,
        sortOrder: 1,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    project.trialRuns = [
      {
        id: "trial_1",
        projectId: project.id,
        mode: "interview",
        questionnaireMarkdown: "## 提问",
        resultMarkdown: "TA 保持了一致的边界。",
        riskNotes: ["低风险"],
        createdAt: project.createdAt,
      },
    ];
    project.beautifications = [
      {
        id: "beauty_1",
        projectId: project.id,
        title: "雨夜状态栏",
        originalText: "状态：等信",
        userRequest: "生成状态栏",
        strategy: "complex",
        worldInfo: {
          comment: "雨夜状态栏",
          content: "角色输出状态时使用 <statusblock>。",
          constant: true,
          keys: [],
          position: 4,
          depth: 4,
          insertion_order: 999,
        },
        regex: "<statusblock>\\s*状态：\\s*(.*?)\\s*</statusblock>",
        html: '<div class="rain-status">$1</div>',
        formattedOriginalText: "<statusblock>\n状态：等信\n</statusblock>",
        enabled: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    project.companions = [
      {
        id: "npc_1",
        projectId: project.id,
        name: "旧管理员",
        role: "知情人",
        summary: "总在闭馆后擦拭借书卡。",
        personality: "谨慎，记忆力很好。",
        relationToMain: "知道 TA 曾经寄丢的那封信。",
        status: "confirmed",
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    project.companionRelations = [
      {
        id: "relation_1",
        projectId: project.id,
        fromNodeId: "main",
        toNodeId: "npc_1",
        label: "旧识",
        description: "旧管理员替 TA 保管过一把铜钥匙。",
        strength: 0.7,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    const cardCompletion = {
      description: "雨夜来客曾在旧图书馆整理无人认领的信，外表温顺但边界明确。",
      personality: "谨慎、克制，想靠近他人却害怕真实身份被认出。",
      tags: ["雨夜", "旧图书馆", "边界感"],
      generationId: "generation_export_1",
      updatedAt: project.updatedAt,
    };
    project.exportDraft = {
      creator: "林屿",
      cardCompletion,
    };

    const card = buildCharacterCard({ project, versionLabel: "1.0", creator: "林屿" });
    const json = formatCharacterCardJson(card);

    expect(card.spec).toBe("chara_card_v3");
    expect(card.spec_version).toBe("3.0");
    expect(card.description).toBe(cardCompletion.description);
    expect(card.personality).toBe(cardCompletion.personality);
    expect(card.tags).toEqual(["雨夜", "旧图书馆", "边界感"]);
    expect(card.data.description).toBe(cardCompletion.description);
    expect(card.data.personality).toBe(cardCompletion.personality);
    expect(card.data.tags).toEqual(["雨夜", "旧图书馆", "边界感"]);
    expect(card.creatorcomment).toBe(project.dossier.markdown);
    expect(card.data.creator_notes).toBe(project.dossier.markdown);
    expect(card.data.creator).toBe("林屿");
    expect(card.data.character_version).toBe("1.0");
    expect(card.data.extensions.world).toBe("雨夜来客");
    expect(card.data.character_book?.name).toBe("雨夜来客");
    expect(card.data.character_book?.entries).toHaveLength(1);
    expect(card.data.character_book?.entries[0]).toMatchObject({
      keys: ["旧馆", "雨水"],
      constant: true,
      position: "4",
      insertion_order: 140,
      extensions: {
        depth: 3,
        position: 4,
      },
    });
    expect(card.data.character_book?.entries[0]?.keys).not.toContain("旧图书馆");
    expect(card.data.extensions.regex_scripts).toHaveLength(1);
    expect(card.data.extensions.regex_scripts[0]).toMatchObject({
      placement: [1, 2],
      markdownOnly: true,
      trimStrings: [],
    });
    expect(Object.keys(card.data.extensions.regex_scripts[0])).toEqual([
      "id",
      "scriptName",
      "findRegex",
      "replaceString",
      "trimStrings",
      "placement",
      "disabled",
      "markdownOnly",
      "promptOnly",
      "runOnEdit",
      "substituteRegex",
      "minDepth",
      "maxDepth",
    ]);
    expect(card.data.first_mes).toContain("{{user}}");
    expect(json).not.toContain("createdAt");
    expect(json).not.toContain("updatedAt");
    expect(json).not.toContain("system_prompt");
    expect(json).not.toContain("post_history_instructions");
    expect(json).not.toContain('"echo"');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("严格按参考角色卡字段导出，不添加额外字段", () => {
    const project = createProjectDraft({
      title: "字段顺序测试",
      dossierMarkdown: "## 核心人格\n\n稳定。\n\n## 开场白\n\n你好。",
    });
    project.exportDraft = {
      creator: "测试作者",
      cardCompletion: {
        description: "角色简介",
        personality: "性格简述",
        tags: ["标签1", "标签2"],
        updatedAt: project.updatedAt,
      },
    };
    project.worldEntries = [
      {
        id: "world_exact",
        projectId: project.id,
        title: "条目名称",
        content: "条目内容",
        keys: ["触发词1", "触发词2"],
        constant: false,
        position: 2,
        depth: 4,
        insertionOrder: 100,
        enabled: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];

    const card = buildCharacterCard({ project, versionLabel: "1.0", creator: "测试作者" });
    const entry = card.data.character_book?.entries[0];

    expect(Object.keys(card)).toEqual([
      "name",
      "description",
      "personality",
      "scenario",
      "first_mes",
      "mes_example",
      "creatorcomment",
      "avatar",
      "talkativeness",
      "fav",
      "tags",
      "spec",
      "spec_version",
      "data",
      "create_date",
    ]);
    expect(Object.keys(card.data)).toEqual([
      "name",
      "description",
      "personality",
      "scenario",
      "first_mes",
      "mes_example",
      "creator_notes",
      "tags",
      "creator",
      "character_version",
      "alternate_greetings",
      "extensions",
      "group_only_greetings",
      "character_book",
    ]);
    expect(Object.keys(card.data.extensions)).toEqual([
      "talkativeness",
      "fav",
      "world",
      "depth_prompt",
      "regex_scripts",
    ]);
    expect(Object.keys(card.data.character_book ?? {})).toEqual(["entries", "name"]);
    expect(entry ? Object.keys(entry) : []).toEqual([
      "id",
      "keys",
      "secondary_keys",
      "comment",
      "content",
      "constant",
      "selective",
      "insertion_order",
      "enabled",
      "position",
      "use_regex",
      "extensions",
    ]);
    expect(entry?.keys).toEqual(["触发词1", "触发词2"]);
    expect(entry?.comment).toBe("条目名称");
    expect(entry?.position).toBe("2");
    expect(entry ? Object.keys(entry.extensions) : []).toEqual([
      "position",
      "exclude_recursion",
      "display_index",
      "probability",
      "useProbability",
      "depth",
      "selectiveLogic",
      "outlet_name",
      "group",
      "group_override",
      "group_weight",
      "prevent_recursion",
      "delay_until_recursion",
      "scan_depth",
      "match_whole_words",
      "use_group_scoring",
      "case_sensitive",
      "automation_id",
      "role",
      "vectorized",
      "sticky",
      "cooldown",
      "delay",
      "match_persona_description",
      "match_character_description",
      "match_character_personality",
      "match_character_depth_prompt",
      "match_scenario",
      "match_creator_notes",
      "triggers",
      "ignore_budget",
    ]);
  });

  it("按采用排序导出主开场白和备用开场白", () => {
    const project = createProjectDraft({
      title: "多开场测试",
      dossierMarkdown: "## 核心人格\n\n稳定。\n\n## 开场白\n\n尚未听见",
    });
    project.greetingVariants = [
      {
        id: "greeting_1",
        projectId: project.id,
        userRole: "开场白",
        content: "备用开场一。",
        selected: false,
        adopted: true,
        sortOrder: 2,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      {
        id: "greeting_2",
        projectId: project.id,
        userRole: "开场白",
        content: "主开场。",
        selected: false,
        adopted: true,
        sortOrder: 1,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      {
        id: "greeting_3",
        projectId: project.id,
        userRole: "开场白",
        content: "不应导出。",
        selected: false,
        adopted: false,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];

    const card = buildCharacterCard({ project });

    expect(card.data.first_mes).toBe("主开场。");
    expect(card.data.alternate_greetings).toEqual(["备用开场一。"]);
  });

  it("美化世界书已经同步到世界书列表时不会重复导出", () => {
    const project = createProjectDraft({ title: "美化去重测试" });
    project.worldEntries = [
      {
        id: "beautification_world_beauty_1",
        projectId: project.id,
        title: "美化规则：状态栏",
        content: "输出 <statusblock> 状态栏。",
        keys: [],
        constant: true,
        position: 4,
        depth: 4,
        insertionOrder: 999,
        enabled: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    project.beautifications = [
      {
        id: "beauty_1",
        projectId: project.id,
        title: "状态栏",
        originalText: "",
        userRequest: "状态栏",
        strategy: "complex",
        worldInfo: {
          comment: "状态栏",
          content: "输出 <statusblock> 状态栏。",
          constant: true,
          keys: [],
          position: 4,
          depth: 4,
          insertion_order: 999,
        },
        regex: "<statusblock>([\\s\\S]*?)</statusblock>",
        html: "$1",
        formattedOriginalText: "",
        enabled: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];

    const card = buildCharacterCard({ project });

    expect(card.data.character_book?.entries).toHaveLength(1);
  });

  it("没有采用开场白时回退到档案开场白", () => {
    const project = createProjectDraft({
      title: "未采用测试",
      dossierMarkdown: "## 核心人格\n\n稳定。\n\n## 开场白\n\n档案里的开场白。",
    });
    project.greetingVariants = [
      {
        id: "greeting_old",
        projectId: project.id,
        userRole: "开场白",
        content: "不应导出。",
        selected: true,
        adopted: false,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];

    const card = buildCharacterCard({ project });

    expect(card.data.first_mes).toBe("档案里的开场白。");
    expect(card.data.alternate_greetings).toEqual([]);
  });
});

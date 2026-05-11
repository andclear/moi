import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import { buildCharacterCard, formatCharacterCardJson } from "@/features/export/characterCardBuilder";

describe("characterCardBuilder", () => {
  it("构建包含角色主体、WorldInfo、开场白和终审摘要的 V3 角色卡", () => {
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
        keywords: ["旧图书馆"],
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
        title: "第一场雨",
        content: "{{char}}把一封潮湿的信推到{{user}}面前。",
        selected: true,
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

    const card = buildCharacterCard({ project, versionLabel: "1.0", note: "首版" });
    const json = formatCharacterCardJson(card);

    expect(card.spec).toBe("chara_card_v3");
    expect(card.spec_version).toBe("3.0");
    expect(card.data.character_book?.entries).toHaveLength(1);
    expect(card.data.first_mes).toContain("{{user}}");
    expect(card.data.creator_notes).toContain("终审摘要");
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

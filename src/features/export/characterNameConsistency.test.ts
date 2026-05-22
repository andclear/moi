import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import type { HistorySnapshot } from "@/db/types";
import { normalizeExportCharacterNames } from "@/features/export/characterNameConsistency";

function createHistory(project: ReturnType<typeof createProjectDraft>, name: string) {
  return {
    id: `history_${name}`,
    projectId: project.id,
    step: project.currentStep,
    title: "历史快照",
    dossier: project.dossier,
    worldEntries: [],
    greetingVariants: [],
    trialRuns: [],
    beautifications: [],
    companions: [
      {
        id: "npc_1",
        projectId: project.id,
        name: "旧管理员",
        role: "NPC",
        summary: "不应被当作主角旧名。",
        personality: "谨慎。",
        relationToMain: "旧识。",
        status: "confirmed",
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ],
    companionRelations: [],
    characterProfile: {
      yaml: `姓名: "${name}"`,
      status: "succeeded",
      retryCount: 1,
    },
    generationIds: [],
    createdAt: project.createdAt,
  } satisfies HistorySnapshot;
}

describe("characterNameConsistency", () => {
  it("导出前只用历史角色信息中的旧姓名替换为最新姓名", () => {
    const project = createProjectDraft({
      title: "姓名一致性",
      dossierMarkdown: "## 核心人格\n\n陈露一直记得旧管理员。\n\n## 开场白\n\n陈露看向{{user}}。",
    });
    project.characterProfile = {
      yaml: '姓名: "林知晚"\n基本信息:\n  年龄: "24"',
      status: "succeeded",
      retryCount: 1,
    };
    project.greetingVariants = [
      {
        id: "greeting_1",
        projectId: project.id,
        userRole: "开场白",
        content: "陈露把钥匙递给{{user}}，旧管理员站在门口。",
        selected: false,
        adopted: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    project.companions = [
      {
        id: "npc_1",
        projectId: project.id,
        name: "旧管理员",
        role: "NPC",
        summary: "旧管理员知道很多。",
        personality: "谨慎。",
        relationToMain: "旧识。",
        status: "confirmed",
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];

    const result = normalizeExportCharacterNames(project, [createHistory(project, "陈露")]);

    expect(result.replacedNames).toEqual(["陈露"]);
    expect(result.project.dossier.markdown).toContain("林知晚一直记得旧管理员");
    expect(result.project.greetingVariants[0]?.content).toContain("林知晚把钥匙递给{{user}}");
    expect(result.project.companions[0]?.name).toBe("旧管理员");
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createEchoDatabase, type EchoDatabase } from "@/db/db";
import { createHistoryService } from "@/db/services/historyService";
import { createProjectRepository } from "@/db/repositories/projectRepository";

describe("historyService", () => {
  let db: EchoDatabase;

  beforeEach(() => {
    db = createEchoDatabase(`echo-history-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it("可以从历史快照恢复项目步骤、档案、世界书、开场白和终审记录", async () => {
    const projects = createProjectRepository(db);
    const history = createHistoryService(db);
    const project = await projects.create({ title: "可恢复项目" });

    await projects.update(project.id, {
      currentStep: "trial",
      dossier: {
        markdown: "## TA 的本心\n\n最初的版本",
        blocks: [],
        updatedAt: "2026-05-10T00:00:00.000Z",
      },
      worldEntries: [
        {
          id: "world_1",
          projectId: project.id,
          title: "旧城区",
          content: "雾气很重。",
          keywords: ["旧城区"],
          enabled: true,
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z",
        },
      ],
      greetingVariants: [
        {
          id: "greeting_1",
          projectId: project.id,
          userRole: "陌生人",
          title: "雨夜",
          content: "你终于来了。",
          selected: true,
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z",
        },
      ],
      trialRuns: [
        {
          id: "trial_1",
          projectId: project.id,
          mode: "interview",
          questionnaireMarkdown: "问题",
          resultMarkdown: "回答",
          riskNotes: [],
          createdAt: "2026-05-10T00:00:00.000Z",
        },
      ],
    });

    const snapshot = await history.createSnapshot(project.id, "终审前");

    await projects.update(project.id, {
      currentStep: "export",
      dossier: {
        markdown: "## TA 的本心\n\n被修改的版本",
        blocks: [],
        updatedAt: "2026-05-11T00:00:00.000Z",
      },
      worldEntries: [],
      greetingVariants: [],
      trialRuns: [],
    });

    const restored = await history.restoreSnapshot(snapshot.id);

    expect(restored.currentStep).toBe("trial");
    expect(restored.dossier.markdown).toContain("最初的版本");
    expect(restored.worldEntries).toHaveLength(1);
    expect(restored.greetingVariants).toHaveLength(1);
    expect(restored.trialRuns).toHaveLength(1);
  });
});

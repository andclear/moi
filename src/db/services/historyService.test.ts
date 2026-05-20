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

  it("可以从历史快照恢复项目步骤、记录、世界书、开场白和相处测试记录", async () => {
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
          title: "旧码头",
          content: "雾气很重。",
          keys: ["旧码头"],
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
          content: "你终于来了。",
          selected: false,
          adopted: true,
          sortOrder: 1,
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

    const snapshot = await history.createSnapshot(project.id, "相处测试前");

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

  it("可以从历史节点复制新版本且不覆盖原项目", async () => {
    const projects = createProjectRepository(db);
    const history = createHistoryService(db);
    const project = await projects.create({ title: "原始回音" });
    await projects.update(project.id, {
      currentStep: "world",
      worldEntries: [
        {
          id: "world_origin",
          projectId: project.id,
          title: "钟楼",
          content: "铜钟已经裂开。",
          keys: ["钟楼"],
          enabled: true,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      ],
    });
    const snapshot = await history.createSnapshot(project.id, "钟楼出现");

    const copied = await history.copySnapshot(snapshot.id);
    const original = await projects.getById(project.id);

    expect(copied.id).not.toBe(project.id);
    expect(copied.title).toContain("历史版本");
    expect(copied.worldEntries[0].projectId).toBe(copied.id);
    expect(original?.id).toBe(project.id);
  });
});

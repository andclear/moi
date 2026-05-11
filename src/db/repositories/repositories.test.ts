import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createEchoDatabase, type EchoDatabase } from "@/db/db";
import { createProjectDraft } from "@/db/defaults";
import { createActivationRepository } from "@/db/repositories/activationRepository";
import { createExportRepository } from "@/db/repositories/exportRepository";
import { createGenerationRepository } from "@/db/repositories/generationRepository";
import { createHistoryRepository } from "@/db/repositories/historyRepository";
import { createProjectRepository } from "@/db/repositories/projectRepository";
import { createSettingsRepository } from "@/db/repositories/settingsRepository";

describe("Dexie repositories", () => {
  let db: EchoDatabase;

  beforeEach(() => {
    db = createEchoDatabase(`echo-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it("projectRepository 支持创建、读取、更新步骤、保存档案和删除", async () => {
    const projects = createProjectRepository(db);
    const project = await projects.create({ title: "雨夜里的回音" });

    expect(await projects.getById(project.id)).toMatchObject({ title: "雨夜里的回音" });

    const stepped = await projects.updateCurrentStep(project.id, "profile");
    expect(stepped?.currentStep).toBe("profile");

    const saved = await projects.updateDossier(project.id, "## TA 的本心\n\n沉默而温柔。");
    expect(saved?.dossier.markdown).toContain("沉默而温柔");

    const copied = await projects.copy(project.id);
    expect(copied.id).not.toBe(project.id);
    expect(copied.title).toContain("副本");

    await projects.delete(project.id);
    expect(await projects.getById(project.id)).toBeUndefined();
    expect(await projects.getById(copied.id)).toBeDefined();
  });

  it("settingsRepository 支持保存和读取 API 设置", async () => {
    const settings = createSettingsRepository(db);

    await settings.saveApiSettings({
      mode: "custom",
      apiBaseUrl: "https://api.example.com/v1",
      apiKey: "sk-local",
      model: "test-model",
      temperature: 0.7,
      supportsSystemPrompt: true,
    });

    const apiSettings = await settings.getApiSettings();
    expect(apiSettings).toMatchObject({
      id: "api",
      mode: "custom",
      model: "test-model",
    });
  });

  it("activationRepository 支持保存、读取和清空当前激活状态", async () => {
    const activations = createActivationRepository(db);

    await activations.save({
      status: "active",
      activatedAt: "2026-05-10T00:00:00.000Z",
      expiresAt: "2026-05-13T00:00:00.000Z",
      sessionToken: "session",
      availableModel: "preset-model",
      usageLimit: 10,
      usageCount: 1,
    });

    expect(await activations.getCurrent()).toMatchObject({ status: "active", usageCount: 1 });

    await activations.clear();
    expect(await activations.getCurrent()).toBeUndefined();
  });

  it("generationRepository 支持创建生成任务并记录成功结果", async () => {
    const project = await createProjectRepository(db).create();
    const generations = createGenerationRepository(db);

    const task = await generations.create({
      projectId: project.id,
      type: "profile",
      inputSummary: "用户描述了一个雨夜出现的人。",
    });
    expect(task.status).toBe("pending");

    const done = await generations.markSucceeded(task.id, { name: "雨夜来客" }, { totalTokens: 42 });
    expect(done).toMatchObject({ status: "succeeded", usage: { totalTokens: 42 } });
  });

  it("historyRepository 和 exportRepository 支持按项目保存记录", async () => {
    const project = await createProjectRepository(db).create({ title: "被寻回的 TA" });
    const histories = createHistoryRepository(db);
    const exports = createExportRepository(db);

    const snapshot = await histories.create({ project, title: "初次保存" });
    const exportRecord = await exports.create({
      projectId: project.id,
      format: "json",
      jsonPreview: '{"spec":"echo"}',
    });

    expect(await histories.getById(snapshot.id)).toMatchObject({ title: "初次保存" });
    expect(await exports.getById(exportRecord.id)).toMatchObject({ format: "json" });
  });

  it("createProjectDraft 提供完整默认结构", () => {
    const project = createProjectDraft({ title: "默认项目" });

    expect(project.dossier.markdown).toContain("## 核心人格");
    expect(project.dossier.markdown).toContain("## 世界观");
    expect(project.dossier.blocks).not.toHaveLength(0);
    expect(project.worldEntries).toEqual([]);
    expect(project.beautifications).toEqual([]);
    expect(project.companions).toEqual([]);
    expect(project.companionRelations).toEqual([]);
    expect(project.currentStep).toBe("post");
  });
});

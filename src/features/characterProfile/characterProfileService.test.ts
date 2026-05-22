import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { echoDb } from "@/db/db";
import { projectRepository } from "@/db/repositories/projectRepository";
import { generateCharacterProfileYaml } from "@/features/llm/llmClient";
import { generateAndSaveCharacterProfile } from "@/features/characterProfile/characterProfileService";

vi.mock("@/features/llm/llmClient", () => ({
  generateCharacterProfileYaml: vi.fn(),
}));

const mockedGenerateCharacterProfileYaml = vi.mocked(generateCharacterProfileYaml);

describe("characterProfileService", () => {
  beforeEach(async () => {
    await echoDb.projects.clear();
    mockedGenerateCharacterProfileYaml.mockReset();
  });

  afterEach(async () => {
    await echoDb.projects.clear();
  });

  it("失败后最多重试三次，并在成功后保存 YAML", async () => {
    const project = await projectRepository.create({ title: "角色信息测试" });
    mockedGenerateCharacterProfileYaml
      .mockRejectedValueOnce(new Error("第一次失败"))
      .mockRejectedValueOnce(new Error("第二次失败"))
      .mockResolvedValueOnce({
        taskId: "generation_1",
        yaml: '姓名: "林雾"',
        response: { content: '姓名: "林雾"' },
      });

    const updatedProject = await generateAndSaveCharacterProfile(project.id, "## 核心人格\n\n沉默");

    expect(mockedGenerateCharacterProfileYaml).toHaveBeenCalledTimes(3);
    expect(updatedProject?.characterProfile).toMatchObject({
      yaml: '姓名: "林雾"',
      status: "succeeded",
      retryCount: 3,
      generationId: "generation_1",
    });
  });

  it("三次都失败时保存失败状态", async () => {
    const project = await projectRepository.create({ title: "角色信息失败测试" });
    mockedGenerateCharacterProfileYaml.mockRejectedValue(new Error("模型失败"));

    const updatedProject = await generateAndSaveCharacterProfile(project.id, "## 核心人格\n\n沉默");

    expect(mockedGenerateCharacterProfileYaml).toHaveBeenCalledTimes(3);
    expect(updatedProject?.characterProfile).toMatchObject({
      yaml: "",
      status: "failed",
      retryCount: 3,
      errorMessage: "模型失败",
    });
  });

  it("重新生成角色信息时保留用户已保存的姓名", async () => {
    const project = await projectRepository.create({ title: "角色信息保名测试" });
    await projectRepository.update(project.id, {
      characterProfile: {
        yaml: '姓名: "陈露"\n别名: "露露"',
        status: "succeeded",
        retryCount: 0,
        updatedAt: project.updatedAt,
      },
    });
    mockedGenerateCharacterProfileYaml.mockResolvedValueOnce({
      taskId: "generation_name",
      yaml: '姓名: "林雾"\n别名: "露露"',
      response: { content: '姓名: "林雾"\n别名: "露露"' },
    });

    const updatedProject = await generateAndSaveCharacterProfile(project.id, "## 核心人格\n\n沉默");

    expect(mockedGenerateCharacterProfileYaml).toHaveBeenCalledWith(
      expect.objectContaining({
        previousCharacterInfo: '姓名: "陈露"\n别名: "露露"',
      }),
    );
    expect(updatedProject?.characterProfile?.yaml).toContain('姓名: "陈露"');
    expect(updatedProject?.characterProfile?.yaml).not.toContain('姓名: "林雾"');
  });

  it("角色档案有姓名时同步到角色信息 YAML 并覆盖模型占位符", async () => {
    const project = await projectRepository.create({ title: "角色信息同步姓名测试" });
    mockedGenerateCharacterProfileYaml.mockResolvedValueOnce({
      taskId: "generation_dossier_name",
      yaml: '姓名: "{{char}}"\n基本信息:\n  年龄: "22"',
      response: { content: '姓名: "{{char}}"\n基本信息:\n  年龄: "22"' },
    });

    const updatedProject = await generateAndSaveCharacterProfile(
      project.id,
      "## 最初的印象\n\n姓名：陈露\n性别：女\n年龄：22\n\n## 核心人格\n\n沉默",
    );

    expect(updatedProject?.characterProfile?.yaml).toContain('姓名: "陈露"');
    expect(updatedProject?.characterProfile?.yaml).not.toContain("{{char}}");
  });

  it("生成角色信息时携带已确认世界书信息", async () => {
    const project = await projectRepository.create({ title: "角色信息世界书测试" });
    await projectRepository.update(project.id, {
      worldEntries: [
        {
          id: "world_1",
          projectId: project.id,
          title: "旧图书馆",
          content: "雨水会从东侧窗框渗入。",
          keys: ["旧馆"],
          constant: true,
          position: 4,
          depth: 4,
          insertionOrder: 100,
          enabled: true,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      ],
    });
    mockedGenerateCharacterProfileYaml.mockResolvedValueOnce({
      taskId: "generation_world",
      yaml: '姓名: "林雾"',
      response: { content: '姓名: "林雾"' },
    });

    await generateAndSaveCharacterProfile(project.id, "## 核心人格\n\n沉默");

    expect(mockedGenerateCharacterProfileYaml).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedWorldEntries: [
          expect.objectContaining({
            title: "旧图书馆",
            content: "雨水会从东侧窗框渗入。",
          }),
        ],
      }),
    );
  });

  it("重新生成角色信息时保留用户已保存的性别和年龄", async () => {
    const project = await projectRepository.create({ title: "角色信息基础字段测试" });
    await projectRepository.update(project.id, {
      characterProfile: {
        yaml: '姓名: "陈露"\n基本信息:\n  年龄: "22"\n  性别: "女"',
        status: "succeeded",
        retryCount: 0,
        updatedAt: project.updatedAt,
      },
    });
    mockedGenerateCharacterProfileYaml.mockResolvedValueOnce({
      taskId: "generation_identity",
      yaml: '姓名: "陈露"\n基本信息:\n  年龄: "31"\n  性别: "男"',
      response: { content: '姓名: "陈露"\n基本信息:\n  年龄: "31"\n  性别: "男"' },
    });

    const updatedProject = await generateAndSaveCharacterProfile(project.id, "## 核心人格\n\n沉默");

    expect(updatedProject?.characterProfile?.yaml).toContain('年龄: "22"');
    expect(updatedProject?.characterProfile?.yaml).toContain('性别: "女"');
    expect(updatedProject?.characterProfile?.yaml).not.toContain('年龄: "31"');
    expect(updatedProject?.characterProfile?.yaml).not.toContain('性别: "男"');
  });
});

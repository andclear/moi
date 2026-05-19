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
});

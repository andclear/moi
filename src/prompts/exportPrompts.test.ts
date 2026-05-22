import { describe, expect, it } from "vitest";

import {
  buildExportCardCompletionMessages,
  buildExportImagePromptMessages,
} from "@/prompts/exportPrompts";
import {
  exportCardCompletionResponseSchema,
  exportImagePromptResponseSchema,
} from "@/schemas/llmResponseSchemas";

describe("exportPrompts", () => {
  it("角色卡补全 prompt 包含角色档案、角色信息和 WorldInfo", () => {
    const messages = buildExportCardCompletionMessages({
      dossierMarkdown: "## 核心人格\n\n谨慎但温和。",
      characterInfoYaml: "姓名: 林知晚\n基本信息:\n  年龄: 24",
      confirmedEntries: [
        {
          id: "world_1",
          projectId: "project_1",
          title: "旧图书馆",
          content: "雨水会从东侧窗框渗入。",
          keys: ["旧馆"],
          constant: true,
          position: 4,
          depth: 4,
          insertionOrder: 100,
          enabled: true,
          createdAt: "2026-05-20T00:00:00.000Z",
          updatedAt: "2026-05-20T00:00:00.000Z",
        },
      ],
    });

    const content = messages.map((message) => message.content).join("\n");

    expect(content).toContain("角色档案 character_profile");
    expect(content).toContain("## 核心人格");
    expect(content).toContain("角色信息 character_info");
    expect(content).toContain("姓名: 林知晚");
    expect(content).toContain("world_info");
    expect(content).toContain("旧图书馆");
    expect(content).toContain("不要生成 description");
    expect(content).toContain("personality");
    expect(content).toContain("至少 400 个中文字符");
    expect(content).toContain("tags");
  });

  it("文生图 prompt 要求包含必要图像维度", () => {
    const messages = buildExportImagePromptMessages({
      dossierMarkdown: "## 外貌特征\n\n黑发，袖口有旧墨痕。",
      characterInfoYaml: "姓名: 林知晚\n外貌:\n  头发: 黑发",
    });

    const content = messages.map((message) => message.content).join("\n");

    expect(content).toContain("主体");
    expect(content).toContain("细节描述");
    expect(content).toContain("环境/背景");
    expect(content).toContain("风格");
    expect(content).toContain("情感");
    expect(content).toContain("构图/镜头");
    expect(content).toContain("图像设定");
    expect(content).toContain("2:3 竖图");
    expect(content).toContain("动漫风格");
    expect(content).toContain("画风指导");
  });

  it("导出响应 schema 能解析补全和文生图结果", () => {
    const personality = "这是足够长的角色性格设定。".repeat(60);

    expect(
      exportCardCompletionResponseSchema.parse({
        personality,
        tags: ["标签1", "标签2"],
      }),
    ).toEqual({
      personality,
      tags: ["标签1", "标签2"],
    });

    expect(exportImagePromptResponseSchema.parse({ prompt: "一段文生图提示词" })).toEqual({
      prompt: "一段文生图提示词",
    });
  });
});

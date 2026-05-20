import { describe, expect, it } from "vitest";

import {
  applyBeautificationToGreetings,
  buildFallbackBeautification,
  inferBeautificationStrategy,
  testBeautificationRegex,
} from "@/features/beautification/beautificationStore";
import { createProjectDraft } from "@/db/defaults";

describe("beautificationStore", () => {
  it("能区分复杂状态文本并生成可测试正则", () => {
    const originalText = "姓名：{{char}}\n状态：平静\n距离：三步之外";
    const fallback = buildFallbackBeautification({
      userRequest: "生成状态栏",
      uiStyle: "none",
      insertIntoGreeting: "primary",
    });

    expect(inferBeautificationStrategy(originalText)).toBe("complex");
    expect(fallback.worldinfo?.content).toContain("statusblock");
    expect(testBeautificationRegex(fallback.regex, fallback.formatted_original_text)).toMatchObject({
      ok: true,
    });
  });

  it("能按选择范围把结构化文本插入已采用开场白", () => {
    const project = createProjectDraft({ id: "project_beauty" });
    project.greetingVariants = [
      {
        id: "greeting_1",
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
        id: "greeting_2",
        projectId: project.id,
        userRole: "开场白",
        content: "备用开场。",
        selected: false,
        adopted: true,
        sortOrder: 2,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    const asset = {
      ...createFallbackBeautificationAssetForTest(project.id, project.createdAt),
      insertIntoGreeting: "primary" as const,
      formattedOriginalText: "<statusblock>状态：等待</statusblock>",
    };

    const nextProject = applyBeautificationToGreetings(project, asset);

    expect(nextProject.greetingVariants[0]?.content).toContain("<statusblock>");
    expect(nextProject.greetingVariants[1]?.content).not.toContain("<statusblock>");
  });
});

function createFallbackBeautificationAssetForTest(projectId: string, now: string) {
  return {
    id: "beauty_1",
    projectId,
    title: "状态栏",
    originalText: "状态：等待",
    userRequest: "生成状态栏",
    strategy: "complex" as const,
    worldInfo: {
      comment: "状态栏",
      content: "输出状态栏。",
      constant: true,
      keys: [],
      position: 4,
      depth: 4,
      insertion_order: 999,
    },
    regex: "<statusblock>\\s*状态：\\s*(.*?)\\s*</statusblock>",
    html: "<div>$1</div>",
    formattedOriginalText: "<statusblock>状态：等待</statusblock>",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

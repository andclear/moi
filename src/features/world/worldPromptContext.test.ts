import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import { collectPromptWorldEntries } from "@/features/world/worldPromptContext";

describe("collectPromptWorldEntries", () => {
  it("合并普通 WorldInfo 和启用美化方案中的 WorldInfo", () => {
    const project = createProjectDraft({ id: "project_prompt_context" });
    project.worldEntries = [
      {
        id: "world_enabled",
        projectId: project.id,
        title: "岛上天气",
        content: "雨天时角色会提到潮湿的气味。",
        keys: ["雨天"],
        enabled: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      {
        id: "world_disabled",
        projectId: project.id,
        title: "禁用条目",
        content: "不应进入 prompt。",
        keys: [],
        enabled: false,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    project.beautifications = [
      {
        id: "beauty_status",
        projectId: project.id,
        title: "状态栏",
        originalText: "",
        userRequest: "",
        strategy: "complex",
        worldInfo: {
          comment: "状态栏格式说明",
          content: "每次回复都输出 <statusblock> 状态栏内容。",
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

    const entries = collectPromptWorldEntries(project);

    expect(entries.map((entry) => entry.title)).toEqual(["岛上天气", "美化规则：状态栏格式说明"]);
    expect(entries[1]?.content).toContain("<statusblock>");
    expect(entries[1]?.constant).toBe(true);
  });

  it("不会把禁用美化方案中的 WorldInfo 带入 prompt 上下文", () => {
    const project = createProjectDraft({ id: "project_prompt_disabled_context" });
    project.beautifications = [
      {
        id: "beauty_disabled",
        projectId: project.id,
        title: "禁用状态栏",
        originalText: "",
        userRequest: "",
        strategy: "complex",
        worldInfo: {
          comment: "禁用状态栏",
          content: "不应进入 prompt。",
          constant: true,
          keys: [],
          position: 4,
          depth: 4,
          insertion_order: 999,
        },
        regex: "",
        html: "",
        formattedOriginalText: "",
        enabled: false,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];

    expect(collectPromptWorldEntries(project)).toEqual([]);
  });
});

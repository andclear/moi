import { describe, expect, it } from "vitest";

import type { BeautificationAsset } from "@/db/types";
import { applyHelloBeautificationsForPreview } from "@/features/hello/helloBeautificationPreview";
import { buildHelloChatMessages } from "@/prompts/helloPrompts";

function createAsset(input: Partial<BeautificationAsset>): BeautificationAsset {
  return {
    id: "beauty_test",
    projectId: "project_test",
    title: "状态栏",
    originalText: "",
    userRequest: "",
    strategy: "complex",
    regex: "<statusblock>\\s*状态：\\s*(.*?)\\s*</statusblock>",
    html: '<div class="status">状态：$1</div>',
    formattedOriginalText: "",
    enabled: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...input,
  };
}

describe("applyHelloBeautificationsForPreview", () => {
  it("将命中的结构化文本替换为美化 HTML", () => {
    const result = applyHelloBeautificationsForPreview(
      "<statusblock>\n状态：等待回应\n</statusblock>",
      [createAsset({})],
    );

    expect(result.didReplace).toBe(true);
    expect(result.content).toContain('<div class="status">状态：等待回应</div>');
  });

  it("兼容 HTML 实体转义后的结构化文本", () => {
    const result = applyHelloBeautificationsForPreview(
      "&lt;statusblock&gt;\n状态：有点紧张\n&lt;/statusblock&gt;",
      [createAsset({})],
    );

    expect(result.didReplace).toBe(true);
    expect(result.content).toContain("状态：有点紧张");
  });

  it("后续回复包含正文和锚定正则时仍会替换状态块", () => {
    const result = applyHelloBeautificationsForPreview(
      "她停顿了一下。\n<statusblock>\n状态：继续观察\n</statusblock>",
      [
        createAsset({
          regex: "^<statusblock>\\s*状态：\\s*(.*?)\\s*</statusblock>$",
        }),
      ],
    );

    expect(result.didReplace).toBe(true);
    expect(result.content).toContain("她停顿了一下。");
    expect(result.content).toContain('<div class="status">状态：继续观察</div>');
  });
});

describe("buildHelloChatMessages", () => {
  it("把 WorldInfo 状态栏规则写入系统硬约束", () => {
    const messages = buildHelloChatMessages({
      mode: "greeting",
      dossierMarkdown: "## 核心人格\n\n稳定。",
      characterInfoYaml: "姓名: 林知晚",
      confirmedEntries: [
        {
          id: "beautification_world_beauty_1",
          projectId: "project_test",
          title: "美化规则：状态栏",
          content: "每轮回复都必须输出 <statusblock> 状态栏。",
          keys: [],
          constant: true,
          position: 4,
          depth: 4,
          insertionOrder: 999,
          enabled: true,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      ],
      selectedGreeting: {
        id: "greeting_1",
        projectId: "project_test",
        userRole: "开场白",
        content: "{{char}}看向{{user}}。",
        selected: false,
        adopted: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      historyMessages: [],
      userInput: "继续",
    });

    expect(messages[0]?.content).toContain("高优先级 WorldInfo");
    expect(messages[0]?.content).toContain("<statusblock>");
    expect(messages[0]?.content).toContain("常驻：是");
  });
});

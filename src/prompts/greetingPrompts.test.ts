import { describe, expect, it } from "vitest";

import { buildGreetingMessages } from "@/prompts/greetingPrompts";

describe("greetingPrompts", () => {
  it("开场白要求使用角色真实姓名和用户占位符", () => {
    const messages = buildGreetingMessages({
      dossierMarkdown: "## 核心人格\n\n稳定。",
      characterInfoYaml: '姓名: "林知晚"\n基本信息:\n  年龄: "24"',
      confirmedEntries: [],
      wordCount: 800,
      personType: "第三人称",
      userRequest: "雨夜重逢。",
    });

    const content = messages.map((message) => message.content).join("\n");

    expect(content).toContain("林知晚");
    expect(content).toContain("必须保留字面占位符 {{user}}");
    expect(content).toContain("不得使用 {{char}}");
    expect(content).toContain("最终输出中禁止出现 {{char}}");
  });
});

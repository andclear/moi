import { describe, expect, it } from "vitest";

import { adaptMessagesForSystemSupport } from "@/features/llm/promptAdapter";

describe("promptAdapter", () => {
  it("在不支持 system prompt 时合并到第一条用户消息", () => {
    const messages = adaptMessagesForSystemSupport(
      [
        { role: "system", content: "你是侧写师。" },
        { role: "user", content: "寻找雨夜出现的人。" },
      ],
      false,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "user" });
    expect(messages[0]?.content).toContain("系统指令");
    expect(messages[0]?.content).toContain("你是侧写师。");
  });

  it("支持 system prompt 时保持原消息结构", () => {
    const messages = [
      { role: "system" as const, content: "系统" },
      { role: "user" as const, content: "用户" },
    ];

    expect(adaptMessagesForSystemSupport(messages, true)).toBe(messages);
  });
});

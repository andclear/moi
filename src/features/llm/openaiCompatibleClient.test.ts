import { describe, expect, it } from "vitest";

import { normalizeChatContent } from "@/features/llm/openaiCompatibleClient";

describe("openaiCompatibleClient", () => {
  it("可以读取兼容渠道返回的 content parts", () => {
    expect(
      normalizeChatContent([
        { type: "text", text: '{"title":"' },
        { type: "text", text: "来岛上" },
        { content: '"}' },
      ]),
    ).toBe('{"title":"来岛上"}');
  });

  it("非字符串内容会安全降级为空字符串", () => {
    expect(normalizeChatContent(null)).toBe("");
    expect(normalizeChatContent([{ type: "image" }])).toBe("");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildFallbackBeautification,
  inferBeautificationStrategy,
  testBeautificationRegex,
} from "@/features/beautification/beautificationStore";

describe("beautificationStore", () => {
  it("能区分复杂状态文本并生成可测试正则", () => {
    const originalText = "姓名：{{char}}\n状态：平静\n距离：三步之外";
    const fallback = buildFallbackBeautification({
      originalText,
      userRequest: "生成状态栏",
    });

    expect(inferBeautificationStrategy(originalText)).toBe("complex");
    expect(fallback.worldinfo?.content).toContain("statusblock");
    expect(testBeautificationRegex(fallback.regex, fallback.formatted_original_text)).toMatchObject({
      ok: true,
    });
  });
});

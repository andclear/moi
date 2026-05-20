import { describe, expect, it } from "vitest";

import type { BeautificationAsset } from "@/db/types";
import { applyHelloBeautificationsForPreview } from "@/features/hello/helloBeautificationPreview";

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
});

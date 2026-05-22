import { describe, expect, it } from "vitest";

import { hasUsableCharacterProfile } from "@/features/characterProfile/characterProfileGuards";

describe("characterProfileGuards", () => {
  it("把空内容和暂未明确视为未生成", () => {
    expect(hasUsableCharacterProfile(undefined)).toBe(false);
    expect(hasUsableCharacterProfile({ yaml: "", status: "succeeded", retryCount: 0 })).toBe(false);
    expect(hasUsableCharacterProfile({ yaml: "暂未明确", status: "succeeded", retryCount: 0 })).toBe(false);
    expect(hasUsableCharacterProfile({ yaml: '"暂未明确"', status: "succeeded", retryCount: 0 })).toBe(false);
  });

  it("只有成功状态且内容有效时才允许导出", () => {
    expect(hasUsableCharacterProfile({ yaml: '姓名: "林雾"', status: "failed", retryCount: 3 })).toBe(false);
    expect(hasUsableCharacterProfile({ yaml: '姓名: "林雾"', status: "succeeded", retryCount: 1 })).toBe(true);
  });
});

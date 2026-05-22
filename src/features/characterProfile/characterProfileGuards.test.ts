import { describe, expect, it } from "vitest";

import { hasUsableCharacterProfile } from "@/features/characterProfile/characterProfileGuards";

describe("characterProfileGuards", () => {
  it("把空内容和暂未明确视为未生成", () => {
    expect(hasUsableCharacterProfile(undefined)).toBe(false);
    expect(hasUsableCharacterProfile({ yaml: "", status: "succeeded", retryCount: 0 })).toBe(false);
    expect(hasUsableCharacterProfile({ yaml: "暂未明确", status: "succeeded", retryCount: 0 })).toBe(false);
    expect(hasUsableCharacterProfile({ yaml: '"暂未明确"', status: "succeeded", retryCount: 0 })).toBe(false);
  });

  it("有有效内容时即使状态卡住也允许恢复使用", () => {
    expect(hasUsableCharacterProfile({ yaml: '姓名: "林雾"', status: "generating", retryCount: 1 })).toBe(true);
    expect(hasUsableCharacterProfile({ yaml: '姓名: "林雾"', status: "failed", retryCount: 3 })).toBe(true);
    expect(hasUsableCharacterProfile({ yaml: '姓名: "林雾"', status: "succeeded", retryCount: 1 })).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  parseCharacterProfileYaml,
  serializeCharacterProfileYaml,
} from "@/features/characterProfile/characterProfileYaml";

describe("characterProfileYaml", () => {
  it("解析并序列化角色信息 YAML 子集", () => {
    const yaml = [
      '姓名: "林雾"',
      "基本信息:",
      '  年龄: "23"',
      '  性别: "女"',
      "个性心理:",
      "  性格特点:",
      '    - "警觉"',
      '    - "温和"',
      "技能与能力: []",
    ].join("\n");

    const parsed = parseCharacterProfileYaml(yaml);
    expect(parsed).toMatchObject({
      姓名: "林雾",
      基本信息: {
        年龄: "23",
        性别: "女",
      },
      个性心理: {
        性格特点: ["警觉", "温和"],
      },
      技能与能力: [],
    });

    const serialized = serializeCharacterProfileYaml(parsed);
    expect(serialized).toContain('姓名: "林雾"');
    expect(serialized).toContain("基本信息:");
    expect(serialized).toContain('- "警觉"');
  });
});

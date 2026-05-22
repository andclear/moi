import { describe, expect, it } from "vitest";

import {
  buildProfileDossierUpdateMessages,
  buildProfileDraftMessages,
} from "@/prompts/profilePrompts";

describe("profilePrompts", () => {
  it("初始角色档案 prompt 要求生成并锁定姓名", () => {
    const content = buildProfileDraftMessages("性别：女\n年龄：22\n雨夜出现。")
      .map((message) => message.content)
      .join("\n");

    expect(content).toContain("必须为 TA 生成一个具体姓名");
    expect(content).toContain("姓名：具体姓名");
    expect(content).toContain("角色必须使用真实姓名");
    expect(content).toContain("后续只有用户手动编辑时才能更改");
  });

  it("档案更新 prompt 要求保留姓名、性别和年龄", () => {
    const content = buildProfileDossierUpdateMessages({
      dossierMarkdown: "## 最初的印象\n\n姓名：陈露\n性别：女\n年龄：22",
      previousChoices: "确认边界感。",
      completedDiaryText: "日记内容。",
    })
      .map((message) => message.content)
      .join("\n");

    expect(content).toContain("姓名、用户最初输入、性别、年龄");
    expect(content).toContain("不得丢弃、改名、改性别或改年龄");
  });
});

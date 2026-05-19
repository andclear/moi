import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import { buildProfileBrief } from "@/features/profile/profileBrief";

describe("buildProfileBrief", () => {
  it("把用户直接提供的性别和年龄放入初始档案 brief", () => {
    const project = createProjectDraft({ title: "问卷项目" });
    project.intake = {
      brief: "TA 总是在雨夜出现。",
      gender: "女",
      age: "23",
      questionnaire: {
        title: "小问卷",
        designNote: "确认方向",
        questions: [
          {
            id: "q1",
            title: "世界观",
            options: [{ id: "o1", label: "现代都市" }],
          },
        ],
      },
    };

    const brief = buildProfileBrief(project, [{ questionId: "q1", optionId: "o1" }]);

    expect(brief).toContain("性别：女");
    expect(brief).toContain("年龄：23");
    expect(brief).toContain("TA 总是在雨夜出现。");
  });

  it("年龄未填写时明确写入未填写", () => {
    const project = createProjectDraft({ title: "问卷项目" });
    project.intake = {
      brief: "TA 总是在雨夜出现。",
      gender: "其他",
    };

    const brief = buildProfileBrief(project, []);

    expect(brief).toContain("性别：其他");
    expect(brief).toContain("年龄：未填写");
  });
});

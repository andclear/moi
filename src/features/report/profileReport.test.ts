import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import { buildProfileReportHtml, createReportFileName } from "@/features/report/profileReport";

describe("profileReport", () => {
  it("生成包含记录、WorldInfo、开场白和相处测试的 HTML 报告", () => {
    const project = createProjectDraft({ title: "雨夜的回音" });
    project.worldEntries = [
      {
        id: "world_1",
        projectId: project.id,
        title: "旧车站",
        content: "月台灯常年闪烁。",
        keys: ["旧车站"],
        enabled: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    project.greetingVariants = [
      {
        id: "greeting_1",
        projectId: project.id,
        userRole: "陌生人",
        title: "月台",
        content: "{{char}}抬头看向{{user}}。",
        selected: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
    project.trialRuns = [
      {
        id: "trial_1",
        projectId: project.id,
        mode: "interview",
        questionnaireMarkdown: "问题",
        resultMarkdown: "相处测试通过。",
        riskNotes: [],
        createdAt: project.createdAt,
      },
    ];

    const html = buildProfileReportHtml(project, "2.0");

    expect(html).toContain("雨夜的回音");
    expect(html).toContain("旧车站");
    expect(html).toContain("相处测试通过");
    expect(createReportFileName(project, "2.0")).toContain("岛民报告");
  });
});

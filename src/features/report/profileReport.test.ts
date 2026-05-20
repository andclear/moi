import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import { buildProfileReportHtml, createReportFileName } from "@/features/report/profileReport";

describe("profileReport", () => {
  it("生成包含记录和结构化相处测试的 HTML 报告，不包含 WorldInfo 与开场白", () => {
    const project = createProjectDraft({
      title: "雨夜的回音",
      dossierMarkdown: "## 核心人格\n\n**温和**但谨慎。\n\n## 开场白\n\n不应出现在报告。",
    });
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
        content: "{{char}}抬头看向{{user}}。",
        selected: false,
        adopted: true,
        sortOrder: 1,
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
        modeResults: {
          interview: {
            title: "三席岛访",
            questions: [
              {
                id: "interview_1",
                question: "**你会如何回应旧友？**",
                interviewer: "记录员",
                intent: "确认边界",
              },
            ],
            answers: [
              {
                questionId: "interview_1",
                formalReply: "**正式**回应。",
                innerMonologue: "心里仍然犹豫。",
                riskSentences: [],
              },
            ],
            riskNotes: [],
          },
          stress: {
            title: "风浪压测",
            questions: [{ id: "stress_1", question: "压力下是否改口？" }],
            answers: [
              {
                questionId: "stress_1",
                formalReply: "不会。",
                innerMonologue: "会害怕，但不退。",
                riskSentences: ["语气可能偏软"],
              },
            ],
            riskNotes: ["保持边界"],
          },
          diary: {
            title: "日记回音",
            questions: [{ id: "diary_1", question: "看到旧日记会怎么做？" }],
            answers: [
              {
                questionId: "diary_1",
                formalReply: "先合上，再解释。",
                innerMonologue: "不想让秘密失控。",
                riskSentences: [],
              },
            ],
            riskNotes: [],
          },
        },
        createdAt: project.createdAt,
      },
    ];

    const html = buildProfileReportHtml(project, "2.0");

    expect(html).toContain("雨夜的回音");
    expect(html).toContain("<strong>温和</strong>");
    expect(html).toContain("<strong>你会如何回应旧友？</strong>");
    expect(html).toContain("<strong>正式</strong>回应");
    expect(html).toContain("多面试官对话");
    expect(html).toContain("风浪压测");
    expect(html).toContain("日记来信");
    expect(html).toContain("问题 1");
    expect(html).toContain("正式回复");
    expect(html).toContain("内心独白");
    expect(html).not.toContain("WorldInfo 摘要");
    expect(html).not.toContain("开场白选择");
    expect(html).not.toContain("旧车站");
    expect(html).not.toContain("不应出现在报告");
    expect(html).not.toContain("{{char}}抬头看向{{user}}。");
    expect(createReportFileName(project, "2.0")).toContain("岛民报告");
  });
});

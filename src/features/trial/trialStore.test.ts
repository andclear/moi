import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import {
  appendTrialRun,
  createTrialRun,
  mergeTrialModeResults,
  replaceLatestTrialRun,
  trialModes,
} from "@/features/trial/trialStore";

describe("trialStore", () => {
  it("可以追加相处测试记录并保留最近一次在最前", () => {
    const project = createProjectDraft({ id: "project_trial" });
    const first = createTrialRun({
      projectId: project.id,
      mode: "interview",
      questionnaireMarkdown: "问题一",
      resultMarkdown: "回答一",
      riskNotes: [],
      now: "2026-05-10T00:00:00.000Z",
    });
    const second = createTrialRun({
      projectId: project.id,
      mode: "diary",
      questionnaireMarkdown: "问题二",
      resultMarkdown: "回答二",
      riskNotes: ["称呼和记录不一致"],
      now: "2026-05-11T00:00:00.000Z",
    });

    const nextProject = appendTrialRun(appendTrialRun(project, first), second);

    expect(nextProject.trialRuns[0].mode).toBe("diary");
    expect(nextProject.trialRuns).toHaveLength(2);
    expect(nextProject.trialRuns[0].riskNotes).toContain("称呼和记录不一致");
  });

  it("可以创建包含三种模式的终审记录", () => {
    const project = createProjectDraft({ id: "project_trial" });
    const modeResults = mergeTrialModeResults({
      questionnaires: {
        interview: {
          title: "三席岛访",
          questions: [{ id: "interview_1", question: "你会怎么面对 {{user}}？" }],
        },
        stress: {
          title: "风浪压测",
          questions: [{ id: "stress_1", question: "如果信念被质疑呢？" }],
        },
        diary: {
          title: "日记来信",
          questions: [{ id: "diary_1", question: "旧誓言还算数吗？" }],
        },
      },
      answers: {
        interview: {
          title: "三席岛访",
          answers: [
            {
              questionId: "interview_1",
              formalReply: "我会先听 {{user}} 说完。",
              innerMonologue: "我其实有点紧张。",
              riskSentences: [],
            },
          ],
          riskNotes: [],
        },
        stress: {
          title: "风浪压测",
          answers: [
            {
              questionId: "stress_1",
              formalReply: "我不会立刻反驳。",
              innerMonologue: "这触到了我的底线。",
              riskSentences: ["我不会立刻反驳。"],
            },
          ],
          riskNotes: ["语气可能偏软"],
        },
        diary: {
          title: "日记来信",
          answers: [
            {
              questionId: "diary_1",
              formalReply: "算数，但我会换一种做法。",
              innerMonologue: "我不想再逃避。",
              riskSentences: [],
            },
          ],
          riskNotes: [],
        },
      },
    });

    const trialRun = createTrialRun({ projectId: project.id, modeResults });

    expect(trialModes).toEqual(["interview", "stress", "diary"]);
    expect(trialRun.modeResults?.interview.questions[0].id).toBe("interview_1");
    expect(trialRun.questionnaireMarkdown).toContain("三席岛访");
    expect(trialRun.resultMarkdown).toContain("内心独白");
    expect(trialRun.riskNotes).toContain("风浪压测：语气可能偏软");
  });

  it("重新测试会覆盖最新记录并保留更早历史", () => {
    const project = createProjectDraft({ id: "project_trial" });
    const oldRun = createTrialRun({
      projectId: project.id,
      mode: "interview",
      questionnaireMarkdown: "旧问卷",
      resultMarkdown: "旧回答",
      riskNotes: [],
      now: "2026-05-10T00:00:00.000Z",
    });
    const latestRun = createTrialRun({
      projectId: project.id,
      mode: "diary",
      questionnaireMarkdown: "最新问卷",
      resultMarkdown: "最新回答",
      riskNotes: [],
      now: "2026-05-11T00:00:00.000Z",
    });
    const replacement = createTrialRun({
      projectId: project.id,
      mode: "stress",
      questionnaireMarkdown: "新问卷",
      resultMarkdown: "新回答",
      riskNotes: [],
      now: "2026-05-12T00:00:00.000Z",
    });

    const nextProject = replaceLatestTrialRun(
      appendTrialRun(appendTrialRun(project, oldRun), latestRun),
      replacement,
    );

    expect(nextProject.trialRuns).toHaveLength(2);
    expect(nextProject.trialRuns[0].resultMarkdown).toBe("新回答");
    expect(nextProject.trialRuns[1].resultMarkdown).toBe("旧回答");
  });
});

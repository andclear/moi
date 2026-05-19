import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import { appendTrialRun, createTrialRun } from "@/features/trial/trialStore";

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
});

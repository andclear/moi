import { describe, expect, it } from "vitest";

import {
  buildPreviousChoiceSummary,
  createEmptyProfileSession,
  getNextProfileStage,
  normalizeProfileChoices,
} from "@/features/profile/profileSession";

describe("profileSession", () => {
  it("创建完整的四段式岛民状态", () => {
    const session = createEmptyProfileSession();

    expect(session.currentStageId).toBe("silhouette");
    expect(Object.keys(session.stages)).toEqual(["silhouette", "exclusion", "fragment", "diary"]);
  });

  it("按阶段顺序推进", () => {
    expect(getNextProfileStage("silhouette")).toBe("exclusion");
    expect(getNextProfileStage("exclusion")).toBe("fragment");
    expect(getNextProfileStage("fragment")).toBe("diary");
    expect(getNextProfileStage("diary")).toBeUndefined();
  });

  it("为候选项补充稳定 ID 并汇总已选择内容", () => {
    const session = createEmptyProfileSession();
    const [choice] = normalizeProfileChoices([
      {
        title: "雨夜里的灯",
        content: "{{char}} 总是在离开前回头。",
        dossierAddition: "TA 的犹疑来自旧约定。",
      },
    ]);

    session.stages.silhouette.choices = [choice];
    session.stages.silhouette.selectedChoiceId = choice.id;

    expect(choice.id).toMatch(/^choice_/);
    expect(buildPreviousChoiceSummary(session)).toContain("初见印象：雨夜里的灯");
  });
});

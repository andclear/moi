import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import {
  createGreetingCandidates,
  selectGreetingVariant,
} from "@/features/greeting/greetingStore";

describe("greetingStore", () => {
  it("选定开场白后只保留一个锁定项并同步记录", () => {
    const project = createProjectDraft({ id: "project_greeting" });
    const [first, second] = createGreetingCandidates("project_greeting", "stranger", [
      { title: "雨夜", content: "{{char}} 递来一封湿透的信。" },
      { title: "旧站台", content: "{{user}} 看见 {{char}} 站在末班车前。" },
    ]);

    const selected = selectGreetingVariant(
      { ...project, greetingVariants: [first, second] },
      second.id,
    );

    expect(selected.greetingVariants.find((variant) => variant.id === second.id)?.selected).toBe(
      true,
    );
    expect(selected.greetingVariants.filter((variant) => variant.selected)).toHaveLength(1);
    expect(selected.dossier.markdown).toContain("{{user}} 看见 {{char}}");
  });
});

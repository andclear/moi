import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import {
  confirmWorldEntry,
  createWorldEntryCandidates,
  formatWorldInfoForDossier,
} from "@/features/world/worldStore";

describe("worldStore", () => {
  it("只把已确认 WorldInfo 写入档案上下文", () => {
    const project = createProjectDraft({ id: "project_world" });
    const [candidate] = createWorldEntryCandidates("project_world", [
      {
        comment: "旧城区钟楼",
        content: "【感官入口】：铜钟边缘已经发绿。",
        keywords: ["钟楼"],
      },
    ]);

    const withCandidate = { ...project, worldEntries: [candidate] };
    expect(formatWorldInfoForDossier(withCandidate.worldEntries)).toContain("尚未听见");

    const confirmed = confirmWorldEntry(withCandidate, candidate.id);
    expect(confirmed.worldEntries[0].enabled).toBe(true);
    expect(confirmed.dossier.markdown).toContain("WorldInfo:");
    expect(confirmed.dossier.markdown).toContain("旧城区钟楼");
  });
});

import type { FlowStepId } from "@/features/flow/flowStore";
import type { DossierDocument, Project } from "@/db/types";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export function createEmptyDossier(now = nowIso()): DossierDocument {
  return {
    markdown: [
      "## TA 的本心",
      "",
      "尚未听见",
      "",
      "## 外貌特征",
      "",
      "尚未听见",
      "",
      "## 背景故事",
      "",
      "尚未听见",
      "",
      "## 核心矛盾",
      "",
      "尚未听见",
      "",
      "## 说话风格",
      "",
      "尚未听见",
      "",
      "## TA 所在的世界",
      "",
      "尚未听见",
      "",
      "## 开场白",
      "",
      "尚未听见",
    ].join("\n"),
    blocks: [],
    updatedAt: now,
  };
}

export function createProjectDraft(input?: {
  id?: string;
  title?: string;
  currentStep?: FlowStepId;
  now?: string;
  dossierMarkdown?: string;
}): Project {
  const now = input?.now ?? nowIso();
  const dossier = createEmptyDossier(now);

  return {
    id: input?.id ?? createId("project"),
    title: input?.title ?? "未命名的回音",
    currentStep: input?.currentStep ?? "post",
    dossier: {
      ...dossier,
      markdown: input?.dossierMarkdown ?? dossier.markdown,
    },
    worldEntries: [],
    greetingVariants: [],
    trialRuns: [],
    createdAt: now,
    updatedAt: now,
  };
}

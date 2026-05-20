import type { FlowStepId } from "@/features/flow/flowStore";
import type { DossierDocument, Project } from "@/db/types";
import {
  buildDossierBlockMeta,
  createDefaultDossierMarkdown,
} from "@/features/dossier/dossierSections";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export function createEmptyDossier(now = nowIso()): DossierDocument {
  const markdown = createDefaultDossierMarkdown();

  return {
    markdown,
    blocks: buildDossierBlockMeta(markdown, [], "ai_inferred", now),
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
  const markdown = input?.dossierMarkdown ?? dossier.markdown;

  return {
    id: input?.id ?? createId("project"),
    title: input?.title ?? "未命名的回音",
    currentStep: input?.currentStep ?? "post",
    dossier: {
      ...dossier,
      markdown,
      blocks: buildDossierBlockMeta(markdown, dossier.blocks, "ai_inferred", now),
    },
    worldEntries: [],
    greetingVariants: [],
    trialRuns: [],
    helloSessions: [],
    beautifications: [],
    companions: [],
    companionRelations: [],
    createdAt: now,
    updatedAt: now,
  };
}

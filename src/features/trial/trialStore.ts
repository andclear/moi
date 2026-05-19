import type { GreetingVariant, Project, TrialRun, WorldEntry } from "@/db/types";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export type TrialMode = TrialRun["mode"];

export const trialModeLabels = {
  interview: "多面试官对话",
  stress: "极压测试",
  diary: "小记对话",
  silent: "安静对话",
} satisfies Record<TrialMode, string>;

export const trialModeDescriptions = {
  interview: "从关系、行动和底线三个角度听 TA 如何回答。",
  stress: "把问题推进到信念与伤口附近，但不制造廉价崩溃。",
  diary: "让过去的誓言与现在的选择互相照见。",
  silent: "同时观察正式回答和没有说出口的那一部分。",
} satisfies Record<TrialMode, string>;

export function getSelectedGreeting(project: Project): GreetingVariant | undefined {
  return project.greetingVariants.find((variant) => variant.selected);
}

export function getConfirmedWorldEntries(project: Project): WorldEntry[] {
  return project.worldEntries.filter((entry) => entry.enabled);
}

export function createTrialRun(input: {
  projectId: string;
  mode: TrialMode;
  questionnaireMarkdown: string;
  resultMarkdown: string;
  riskNotes: string[];
  now?: string;
}) {
  const now = input.now ?? nowIso();

  return {
    id: createId("trial"),
    projectId: input.projectId,
    mode: input.mode,
    questionnaireMarkdown: input.questionnaireMarkdown,
    resultMarkdown: input.resultMarkdown,
    riskNotes: input.riskNotes,
    createdAt: now,
  } satisfies TrialRun;
}

export function appendTrialRun(project: Project, trialRun: TrialRun) {
  const now = nowIso();

  return {
    ...project,
    trialRuns: [trialRun, ...project.trialRuns],
    updatedAt: now,
  } satisfies Project;
}

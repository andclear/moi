import type {
  ProfileChoice,
  ProfileSession,
  ProfileStageId,
  ProfileStageState,
} from "@/db/types";
import { createId } from "@/shared/lib/ids";

export const profileStageOrder: ProfileStageId[] = [
  "silhouette",
  "exclusion",
  "fragment",
  "diary",
];

export const profileStageLabels: Record<ProfileStageId, string> = {
  silhouette: "内心独白",
  exclusion: "这不是TA",
  fragment: "叙事碎片",
  diary: "日记破译",
};

export const profileStageDescriptions: Record<ProfileStageId, string> = {
  silhouette: "阅读三段内心独白，选择最像 TA 的那一个。",
  exclusion: "这里要反向选择：选出最不可能是 TA 的方向。",
  fragment: "从三个很短的片段里，选择最能补充 TA 的一段。",
  diary: "读一篇被遮住关键处的日记，用选择器补全它。",
};

function emptyStage(stageId: ProfileStageId): ProfileStageState {
  return { stageId, choices: [] };
}

export function createEmptyProfileSession(): ProfileSession {
  return {
    currentStageId: "silhouette",
    stages: {
      silhouette: emptyStage("silhouette"),
      exclusion: emptyStage("exclusion"),
      fragment: emptyStage("fragment"),
      diary: emptyStage("diary"),
    },
  };
}

export function normalizeProfileChoices(
  choices: Array<Omit<ProfileChoice, "id">>,
): ProfileChoice[] {
  return choices.map((choice) => ({
    ...choice,
    id: createId("choice"),
  }));
}

export function getNextProfileStage(stageId: ProfileStageId) {
  const index = profileStageOrder.indexOf(stageId);
  return profileStageOrder[index + 1];
}

export function buildPreviousChoiceSummary(session: ProfileSession) {
  return profileStageOrder
    .map((stageId) => {
      const stage = session.stages[stageId];
      if (stageId === "diary" && stage.completedDiaryText) {
        return `${profileStageLabels[stageId]}：${stage.completedDiaryText}`;
      }

      const choice = stage.choices.find((item) => item.id === stage.selectedChoiceId);
      return choice ? `${profileStageLabels[stageId]}：${choice.title} - ${choice.content}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function getSelectedProfileChoice(session: ProfileSession, stageId: ProfileStageId) {
  const stage = session.stages[stageId];
  return stage.choices.find((item) => item.id === stage.selectedChoiceId);
}

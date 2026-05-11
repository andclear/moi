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
  silhouette: "剪影选择",
  exclusion: "反例排除",
  fragment: "碎片叙事",
  diary: "私密日记",
};

export const profileStageDescriptions: Record<ProfileStageId, string> = {
  silhouette: "从三道朦胧轮廓里，认出 TA 最接近的行动方式。",
  exclusion: "排除那个差一点像 TA 的影子，让真正的轮廓更清楚。",
  fragment: "在一个短促瞬间里，看见 TA 会如何选择。",
  diary: "揭开被涂掉的句子，确认 TA 心底最不能轻易说出口的矛盾。",
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
      const choice = stage.choices.find((item) => item.id === stage.selectedChoiceId);
      return choice ? `${profileStageLabels[stageId]}：${choice.title} - ${choice.content}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

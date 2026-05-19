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
  silhouette: "初见印象",
  exclusion: "不合拍之处",
  fragment: "小岛片段",
  diary: "内心小记",
};

export const profileStageDescriptions: Record<ProfileStageId, string> = {
  silhouette: "从三种初见感觉里，选出最接近 TA 的行动方式。",
  exclusion: "排除那个差一点像 TA、但其实不合拍的方向。",
  fragment: "在一个小岛上的短促瞬间里，看见 TA 会如何选择。",
  diary: "确认 TA 心底最不容易说出口的矛盾。",
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

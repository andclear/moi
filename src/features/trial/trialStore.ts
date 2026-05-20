import type {
  GreetingVariant,
  Project,
  TrialModeResult,
  TrialModeResults,
  TrialRun,
  WorldEntry,
} from "@/db/types";
import { getAdoptedGreetingVariants } from "@/features/greeting/greetingStore";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export type TrialMode = TrialRun["mode"];

export const trialModes = ["interview", "stress", "diary"] as const satisfies readonly TrialMode[];

export const trialModeLabels = {
  interview: "多面试官对话",
  stress: "风浪压测",
  diary: "日记回声",
} satisfies Record<TrialMode, string>;

export const trialModeIntentLabels = {
  interview: "多面试官对话",
  stress: "极压测试",
  diary: "日记对话",
} satisfies Record<TrialMode, string>;

export function getSelectedGreeting(project: Project): GreetingVariant | undefined {
  return getAdoptedGreetingVariants(project)[0];
}

export function getConfirmedWorldEntries(project: Project): WorldEntry[] {
  return project.worldEntries.filter((entry) => entry.enabled);
}

function flattenQuestionnaire(modeResults: TrialModeResults) {
  return trialModes
    .map((mode) => {
      const result = modeResults[mode];
      const questions = result.questions
        .map((question, index) => {
          const speaker = question.interviewer ? `${question.interviewer}：` : "";
          return `${index + 1}. ${speaker}${question.question}`;
        })
        .join("\n");
      return `## ${result.title}\n${questions}`;
    })
    .join("\n\n");
}

function flattenResult(modeResults: TrialModeResults) {
  return trialModes
    .map((mode) => {
      const result = modeResults[mode];
      const answers = result.questions
        .map((question, index) => {
          const answer = result.answers.find((item) => item.questionId === question.id);
          return [
            `### ${index + 1}. ${question.question}`,
            `正式回复：${answer?.formalReply ?? "尚未回答。"}`,
            `内心独白：${answer?.innerMonologue ?? "尚未回答。"}`,
          ].join("\n");
        })
        .join("\n\n");
      return `## ${result.title}\n${answers}`;
    })
    .join("\n\n");
}

function collectRiskNotes(modeResults: TrialModeResults) {
  return trialModes.flatMap((mode) => {
    const result = modeResults[mode];
    return [
      ...result.riskNotes.map((note) => `${result.title}：${note}`),
      ...result.answers.flatMap((answer) =>
        answer.riskSentences.map((sentence) => `${result.title}：${sentence}`),
      ),
    ];
  });
}

export function mergeTrialModeResults(input: {
  questionnaires: Record<TrialMode, Pick<TrialModeResult, "title" | "questions">>;
  answers: Record<TrialMode, Pick<TrialModeResult, "title" | "answers" | "riskNotes">>;
}): TrialModeResults {
  return trialModes.reduce((result, mode) => {
    result[mode] = {
      title: input.questionnaires[mode]?.title || trialModeLabels[mode],
      questions: input.questionnaires[mode]?.questions ?? [],
      answers: input.answers[mode]?.answers ?? [],
      riskNotes: input.answers[mode]?.riskNotes ?? [],
    };
    return result;
  }, {} as TrialModeResults);
}

export function createTrialRun(input: {
  projectId: string;
  mode?: TrialMode;
  questionnaireMarkdown?: string;
  resultMarkdown?: string;
  riskNotes?: string[];
  modeResults?: TrialModeResults;
  now?: string;
}) {
  const now = input.now ?? nowIso();
  const questionnaireMarkdown =
    input.questionnaireMarkdown ??
    (input.modeResults ? flattenQuestionnaire(input.modeResults) : "");
  const resultMarkdown =
    input.resultMarkdown ?? (input.modeResults ? flattenResult(input.modeResults) : "");
  const riskNotes =
    input.riskNotes ?? (input.modeResults ? collectRiskNotes(input.modeResults) : []);

  return {
    id: createId("trial"),
    projectId: input.projectId,
    mode: input.mode ?? "interview",
    questionnaireMarkdown,
    resultMarkdown,
    riskNotes,
    modeResults: input.modeResults,
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

export function replaceLatestTrialRun(project: Project, trialRun: TrialRun) {
  const now = nowIso();
  const [, ...olderRuns] = project.trialRuns;

  return {
    ...project,
    trialRuns: [trialRun, ...olderRuns],
    updatedAt: now,
  } satisfies Project;
}

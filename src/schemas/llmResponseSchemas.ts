import { z } from "zod";

export const generationUsageSchema = z.object({
  promptTokens: z.number().int().min(0).optional(),
  completionTokens: z.number().int().min(0).optional(),
  totalTokens: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),
});

export const generationTaskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: z.enum([
    "character_profile",
    "profile",
    "intake_questionnaire",
    "world",
    "greeting",
    "trial_questionnaire",
    "trial_answer",
    "beautification",
    "companion",
    "export",
  ]),
  status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]),
  inputSummary: z.string(),
  output: z.unknown().optional(),
  usage: generationUsageSchema.optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const structuredLlmResponseSchema = z.object({
  summary: z.string(),
  data: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()).default([]),
});

export const profileDraftResponseSchema = z.object({
  title: z.string().min(1),
  dossierMarkdown: z.string().min(1),
});

export const intakeQuestionnaireResponseSchema = z.object({
  title: z.string().min(1),
  questions: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        options: z
          .array(
            z.object({
              label: z.string().min(1),
              allowCustom: z.boolean().optional(),
            }),
          )
          .min(2),
      }),
    )
    .min(5),
});

export const profileChoiceResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        detail: z.string().optional(),
        dossierAddition: z.string().min(1),
      }),
    )
    .length(3),
});

export const profileDiaryResponseSchema = z.object({
  title: z.string().min(1),
  diaryText: z.string().min(1),
  note: z.string().optional(),
  blanks: z
    .array(
      z.object({
        key: z.string().min(1).optional(),
        label: z.string().min(1),
        options: z
          .array(
            z.object({
              label: z.string().min(1),
              meaning: z.string().min(1),
            }),
          )
          .min(3),
      }),
    )
    .min(3),
});

export const profileDossierUpdateResponseSchema = z.object({
  title: z.string().min(1),
  dossierMarkdown: z.string().min(1),
  summary: z.string().optional(),
});

const booleanLikeSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const numberLikeSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().int().optional());

const positionLikeSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().int().min(0).max(4));

const nonNegativeNumberLikeSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().int().min(0).optional());

const stringArrayLikeSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // 不是 JSON 数组时，按常见分隔符拆分。
  }

  return trimmed
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(/[、,\s]+/)
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}, z.array(z.string().min(1)));

export const worldEntryResponseSchema = z
  .array(
    z.object({
      comment: z.string().min(1),
      content: z.string().min(1),
      keys: stringArrayLikeSchema.default([]),
      constant: booleanLikeSchema.optional(),
      position: positionLikeSchema.optional(),
      depth: nonNegativeNumberLikeSchema.optional(),
      insertion_order: numberLikeSchema.optional(),
    }),
  )
  .min(1)
  .max(10);

export const greetingVariantResponseSchema = z
  .array(
    z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      atmosphere: z.string().optional(),
    }),
  )
  .min(1)
  .max(3);

export const trialQuestionnaireResponseSchema = z.object({
  title: z.string().min(1),
  questionnaireMarkdown: z.string().min(1),
});

export const trialAnswerResponseSchema = z.object({
  resultMarkdown: z.string().min(1),
  formalReplies: z.array(z.string().min(1)).min(1),
  innerMonologues: z.array(z.string().min(1)).min(1),
  riskNotes: z.array(z.string().min(1)).default([]),
});

export const beautificationResponseSchema = z.object({
  worldinfo: z
    .object({
      key: z.string().min(1),
      content: z.string().min(1),
    })
    .nullable(),
  regex: z.string().min(1),
  html: z.string().min(1),
  original_text: z.string().default(""),
  formatted_original_text: z.string().min(1),
});

export const companionResponseSchema = z.object({
  silhouettes: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        summary: z.string().min(1),
        personality: z.string().min(1),
        relationToMain: z.string().min(1),
      }),
    )
    .length(3),
  exclusions: z
    .array(
      z.object({
        title: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .length(2),
  fragment: z.string().min(1),
});

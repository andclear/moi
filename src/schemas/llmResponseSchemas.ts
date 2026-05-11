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
  type: z.enum(["profile", "world", "greeting", "trial_questionnaire", "trial_answer", "export"]),
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

export const worldEntryResponseSchema = z
  .array(
    z.object({
      comment: z.string().min(1),
      content: z.string().min(1),
      keywords: z.array(z.string().min(1)).default([]),
    }),
  )
  .min(1)
  .max(3);

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

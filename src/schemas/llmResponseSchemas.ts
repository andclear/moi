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

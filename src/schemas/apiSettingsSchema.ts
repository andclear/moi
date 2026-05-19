import { z } from "zod";

export const apiSettingsSchema = z.object({
  id: z.literal("api"),
  mode: z.enum(["none", "custom", "preset"]),
  apiBaseUrl: z.url().or(z.literal("")),
  apiKey: z.string().optional(),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  supportsSystemPrompt: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const activationRecordSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["inactive", "active", "expired", "disabled"]),
  activatedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  sessionToken: z.string().optional(),
  availableModel: z.string().optional(),
  usageLimit: z.number().int().min(0).optional(),
  usageCount: z.number().int().min(0),
  updatedAt: z.string().datetime(),
});

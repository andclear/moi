import { z } from "zod";

export const flowStepIdSchema = z.enum(["post", "profile", "world", "greeting", "trial", "export"]);

export const dossierBlockMetaSchema = z.object({
  blockId: z.string().min(1),
  section: z.string().min(1),
  contentHash: z.string().min(1),
  source: z.enum(["ai_inferred", "user_confirmed"]),
  locked: z.boolean(),
  updatedByGenerationId: z.string().optional(),
  updatedAt: z.string().datetime(),
});

export const dossierDocumentSchema = z.object({
  markdown: z.string(),
  blocks: z.array(dossierBlockMetaSchema),
  updatedAt: z.string().datetime(),
});

export const worldEntrySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string(),
  content: z.string(),
  keywords: z.array(z.string()),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const greetingVariantSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  userRole: z.string(),
  title: z.string(),
  content: z.string(),
  selected: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const trialRunSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  mode: z.enum(["interview", "stress", "diary", "silent"]),
  questionnaireMarkdown: z.string(),
  resultMarkdown: z.string(),
  riskNotes: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  currentStep: flowStepIdSchema,
  dossier: dossierDocumentSchema,
  worldEntries: z.array(worldEntrySchema),
  greetingVariants: z.array(greetingVariantSchema),
  trialRuns: z.array(trialRunSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().optional(),
});

export const historySnapshotSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  step: flowStepIdSchema,
  title: z.string().min(1),
  dossier: dossierDocumentSchema,
  worldEntries: z.array(worldEntrySchema),
  greetingVariants: z.array(greetingVariantSchema),
  trialRuns: z.array(trialRunSchema),
  generationIds: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export type ProjectSchema = z.infer<typeof projectSchema>;

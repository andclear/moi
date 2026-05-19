import { z } from "zod";

export const flowStepIdSchema = z.enum([
  "post",
  "questionnaire",
  "profile",
  "world",
  "greeting",
  "trial",
  "export",
]);

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
  keys: z.array(z.string()).optional(),
  constant: z.boolean().optional(),
  position: z.number().int().min(0).max(4).optional(),
  depth: z.number().int().min(0).optional(),
  insertionOrder: z.number().int().optional(),
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

export const beautificationAssetSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  originalText: z.string(),
  userRequest: z.string(),
  strategy: z.enum(["simple", "complex"]),
  worldInfo: z
    .object({
      key: z.string().min(1),
      content: z.string().min(1),
    })
    .nullable()
    .optional(),
  regex: z.string(),
  html: z.string(),
  formattedOriginalText: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const companionNodeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  role: z.string(),
  summary: z.string(),
  personality: z.string(),
  relationToMain: z.string(),
  status: z.enum(["candidate", "confirmed"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const companionRelationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  label: z.string(),
  description: z.string(),
  strength: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const characterProfileDocumentSchema = z.object({
  yaml: z.string(),
  status: z.enum(["idle", "generating", "succeeded", "failed"]),
  retryCount: z.number().int().min(0),
  errorMessage: z.string().optional(),
  generationId: z.string().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  currentStep: flowStepIdSchema,
  dossier: dossierDocumentSchema,
  worldEntries: z.array(worldEntrySchema),
  greetingVariants: z.array(greetingVariantSchema),
  trialRuns: z.array(trialRunSchema),
  beautifications: z.array(beautificationAssetSchema).default([]),
  companions: z.array(companionNodeSchema).default([]),
  companionRelations: z.array(companionRelationSchema).default([]),
  profileSession: z.unknown().optional(),
  intake: z.unknown().optional(),
  characterProfile: characterProfileDocumentSchema.optional(),
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
  beautifications: z.array(beautificationAssetSchema).default([]),
  companions: z.array(companionNodeSchema).default([]),
  companionRelations: z.array(companionRelationSchema).default([]),
  profileSession: z.unknown().optional(),
  intake: z.unknown().optional(),
  characterProfile: characterProfileDocumentSchema.optional(),
  generationIds: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export type ProjectSchema = z.infer<typeof projectSchema>;

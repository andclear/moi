import type { FlowStepId } from "@/features/flow/flowStore";

export type DossierBlockSource = "ai_inferred" | "user_confirmed";
export type GenerationStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";
export type GenerationType =
  | "profile"
  | "world"
  | "greeting"
  | "trial_questionnaire"
  | "trial_answer"
  | "export";
export type ExportFormat = "json" | "png";

export interface DossierBlockMeta {
  blockId: string;
  section: string;
  contentHash: string;
  source: DossierBlockSource;
  locked: boolean;
  updatedByGenerationId?: string;
  updatedAt: string;
}

export interface DossierDocument {
  markdown: string;
  blocks: DossierBlockMeta[];
  updatedAt: string;
}

export interface WorldEntry {
  id: string;
  projectId: string;
  title: string;
  content: string;
  keywords: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GreetingVariant {
  id: string;
  projectId: string;
  userRole: string;
  title: string;
  content: string;
  selected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrialRun {
  id: string;
  projectId: string;
  mode: "interview" | "stress" | "diary" | "silent";
  questionnaireMarkdown: string;
  resultMarkdown: string;
  riskNotes: string[];
  createdAt: string;
}

export type ProfileStageId = "silhouette" | "exclusion" | "fragment" | "diary";

export interface ProfileChoice {
  id: string;
  title: string;
  content: string;
  detail?: string;
  dossierAddition: string;
}

export interface ProfileStageState {
  stageId: ProfileStageId;
  choices: ProfileChoice[];
  selectedChoiceId?: string;
  generationId?: string;
  completedAt?: string;
}

export interface ProfileSession {
  currentStageId: ProfileStageId;
  stages: Record<ProfileStageId, ProfileStageState>;
}

export interface Project {
  id: string;
  title: string;
  currentStep: FlowStepId;
  dossier: DossierDocument;
  worldEntries: WorldEntry[];
  greetingVariants: GreetingVariant[];
  trialRuns: TrialRun[];
  profileSession?: ProfileSession;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface HistorySnapshot {
  id: string;
  projectId: string;
  step: FlowStepId;
  title: string;
  dossier: DossierDocument;
  worldEntries: WorldEntry[];
  greetingVariants: GreetingVariant[];
  trialRuns: TrialRun[];
  profileSession?: ProfileSession;
  generationIds: string[];
  createdAt: string;
}

export interface GenerationUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs?: number;
}

export interface GenerationTask {
  id: string;
  projectId: string;
  type: GenerationType;
  status: GenerationStatus;
  inputSummary: string;
  output?: unknown;
  usage?: GenerationUsage;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportRecord {
  id: string;
  projectId: string;
  format: ExportFormat;
  versionLabel?: string;
  note?: string;
  jsonPreview: string;
  pngTextKey?: string;
  createdAt: string;
}

export interface ApiSettings {
  id: "api";
  mode: "none" | "custom" | "preset";
  apiBaseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  supportsSystemPrompt: boolean;
  updatedAt: string;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface ActivationRecord {
  id: string;
  status: "inactive" | "active" | "expired" | "disabled";
  activatedAt?: string;
  expiresAt?: string;
  sessionToken?: string;
  availableModel?: string;
  usageLimit?: number;
  usageCount: number;
  updatedAt: string;
}

export interface AdminSettingRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

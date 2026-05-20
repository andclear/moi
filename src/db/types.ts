import type { FlowStepId } from "@/features/flow/flowStore";

export type DossierBlockSource = "ai_inferred" | "user_confirmed";
export type GenerationStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";
export type GenerationType =
  | "intake_questionnaire"
  | "character_profile"
  | "dossier_edit"
  | "profile"
  | "world"
  | "greeting"
  | "trial_questionnaire"
  | "trial_answer"
  | "trial_revision"
  | "beautification"
  | "companion"
  | "export";
export type BeautificationGreetingInsertMode = "none" | "primary" | "all_adopted";
export type BeautificationUiStyleId =
  | "none"
  | "aurora_glass"
  | "digital_garden"
  | "soft_future"
  | "cyber_elegant"
  | "nordic_minimal";
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
  keys: string[];
  constant?: boolean;
  position?: number;
  depth?: number;
  insertionOrder?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GreetingVariant {
  id: string;
  projectId: string;
  userRole: string;
  content: string;
  selected: boolean;
  adopted?: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrialRun {
  id: string;
  projectId: string;
  mode: "interview" | "stress" | "diary";
  questionnaireMarkdown: string;
  resultMarkdown: string;
  riskNotes: string[];
  modeResults?: TrialModeResults;
  createdAt: string;
}

export interface TrialQuestion {
  id: string;
  question: string;
  interviewer?: string;
  intent?: string;
}

export interface TrialAnswer {
  questionId: string;
  formalReply: string;
  innerMonologue: string;
  riskSentences: string[];
}

export interface TrialModeResult {
  title: string;
  questions: TrialQuestion[];
  answers: TrialAnswer[];
  riskNotes: string[];
}

export type TrialModeResults = Record<TrialRun["mode"], TrialModeResult>;

export interface BeautificationAsset {
  id: string;
  projectId: string;
  title: string;
  originalText: string;
  userRequest: string;
  uiStyle?: BeautificationUiStyleId;
  strategy: "simple" | "complex";
  worldInfo?: {
    comment: string;
    content: string;
    constant: boolean;
    keys: string[];
    position: number;
    depth?: number | "";
    insertion_order: number;
  } | null;
  regex: string;
  regexTitle?: string;
  html: string;
  formattedOriginalText: string;
  insertIntoGreeting?: BeautificationGreetingInsertMode;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanionNode {
  id: string;
  projectId: string;
  name: string;
  role: string;
  summary: string;
  personality: string;
  relationToMain: string;
  status: "candidate" | "confirmed";
  createdAt: string;
  updatedAt: string;
}

export interface CompanionRelation {
  id: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
  description: string;
  strength: number;
  createdAt: string;
  updatedAt: string;
}

export type ProfileStageId = "silhouette" | "exclusion" | "fragment" | "diary";

export interface ProfileChoice {
  id: string;
  title: string;
  content: string;
  detail?: string;
  dossierAddition: string;
}

export interface ProfileDiaryBlankOption {
  key: string;
  label: string;
  meaning: string;
}

export interface ProfileDiaryBlank {
  key: string;
  label: string;
  options: ProfileDiaryBlankOption[];
}

export interface ProfileDiaryDraft {
  title: string;
  diaryText: string;
  blanks: ProfileDiaryBlank[];
  note?: string;
}

export interface ProfileStageState {
  stageId: ProfileStageId;
  choices: ProfileChoice[];
  diaryDraft?: ProfileDiaryDraft;
  diarySelections?: Record<string, string>;
  completedDiaryText?: string;
  selectedChoiceId?: string;
  generationId?: string;
  completedAt?: string;
}

export interface ProfileSession {
  currentStageId: ProfileStageId;
  stages: Record<ProfileStageId, ProfileStageState>;
}

export interface IntakeQuestionOption {
  id: string;
  label: string;
  allowCustom?: boolean;
}

export interface IntakeQuestion {
  id: string;
  title: string;
  description?: string;
  options: IntakeQuestionOption[];
}

export interface IntakeQuestionnaire {
  title: string;
  designNote: string;
  questions: IntakeQuestion[];
}

export interface IntakeAnswer {
  questionId: string;
  optionId: string;
  customValue?: string;
}

export interface ProjectIntake {
  brief: string;
  gender: string;
  age?: string;
  questionnaire?: IntakeQuestionnaire;
  answers?: IntakeAnswer[];
  generationId?: string;
}

export interface CharacterProfileDocument {
  yaml: string;
  status: "idle" | "generating" | "succeeded" | "failed";
  retryCount: number;
  errorMessage?: string;
  generationId?: string;
  updatedAt?: string;
}

export interface Project {
  id: string;
  title: string;
  currentStep: FlowStepId;
  dossier: DossierDocument;
  worldEntries: WorldEntry[];
  greetingVariants: GreetingVariant[];
  trialRuns: TrialRun[];
  beautifications: BeautificationAsset[];
  companions: CompanionNode[];
  companionRelations: CompanionRelation[];
  profileSession?: ProfileSession;
  intake?: ProjectIntake;
  characterProfile?: CharacterProfileDocument;
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
  beautifications: BeautificationAsset[];
  companions: CompanionNode[];
  companionRelations: CompanionRelation[];
  profileSession?: ProfileSession;
  intake?: ProjectIntake;
  characterProfile?: CharacterProfileDocument;
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

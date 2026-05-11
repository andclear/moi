import type { GenerationType } from "@/db/types";

export type LlmRole = "system" | "user" | "assistant";
export type LlmMode = "custom" | "preset";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmRequest {
  projectId: string;
  type: GenerationType;
  messages: LlmMessage[];
  inputSummary: string;
  signal?: AbortSignal;
}

export interface LlmResponse {
  content: string;
  raw?: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    durationMs?: number;
  };
}

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

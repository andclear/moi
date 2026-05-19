import globalPromptMarkdown from "@/prompts/global_prompt.md?raw";
import type { LlmMessage } from "@/features/llm/llmTypes";

export const globalPrompt = globalPromptMarkdown.trim();

export function withGlobalPrompt(messages: LlmMessage[]): LlmMessage[] {
  if (!globalPrompt) {
    return messages;
  }

  return [{ role: "system", content: globalPrompt }, ...messages];
}

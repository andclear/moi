import type { LlmMessage } from "@/features/llm/llmTypes";

export function adaptMessagesForSystemSupport(messages: LlmMessage[], supportsSystemPrompt: boolean) {
  if (supportsSystemPrompt) {
    return messages;
  }

  const systemMessages = messages.filter((message) => message.role === "system");
  const otherMessages = messages.filter((message) => message.role !== "system");
  if (systemMessages.length === 0) {
    return otherMessages;
  }

  const mergedSystem = systemMessages.map((message) => message.content).join("\n\n");
  const firstUserIndex = otherMessages.findIndex((message) => message.role === "user");

  if (firstUserIndex === -1) {
    return [{ role: "user", content: mergedSystem }, ...otherMessages] satisfies LlmMessage[];
  }

  return otherMessages.map((message, index) =>
    index === firstUserIndex
      ? {
          ...message,
          content: `系统指令：\n${mergedSystem}\n\n用户内容：\n${message.content}`,
        }
      : message,
  );
}

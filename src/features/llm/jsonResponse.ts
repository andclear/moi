import type { z } from "zod";

import { LlmError } from "@/features/llm/llmTypes";

export function extractJsonObject(text: string) {
  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const source = fencedMatch?.[1] ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new LlmError("模型响应中没有可解析的 JSON。", "json_not_found");
  }

  try {
    return JSON.parse(source.slice(start, end + 1)) as unknown;
  } catch (error) {
    throw new LlmError("模型响应 JSON 解析失败。", "json_parse_failed", error);
  }
}

export function parseLlmJson<TSchema extends z.ZodType>(
  text: string,
  schema: TSchema,
): z.infer<TSchema> {
  return schema.parse(extractJsonObject(text));
}

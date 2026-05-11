import type { z } from "zod";

import { LlmError } from "@/features/llm/llmTypes";

function stripJsonFence(text: string) {
  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fencedMatch?.[1] ?? text).trim();
}

function findJsonBounds(source: string) {
  const objectStart = source.indexOf("{");
  const arrayStart = source.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) {
    return null;
  }

  const start = Math.min(...starts);
  const opener = source[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === opener) {
      depth += 1;
    }
    if (char === closer) {
      depth -= 1;
      if (depth === 0) {
        return { start, end: index + 1 };
      }
    }
  }

  return null;
}

export function extractJsonValue(text: string) {
  const source = stripJsonFence(text);

  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    const bounds = findJsonBounds(source);
    if (!bounds) {
      throw new LlmError("模型响应中没有可解析的 JSON。", "json_not_found", error);
    }

    try {
      return JSON.parse(source.slice(bounds.start, bounds.end)) as unknown;
    } catch (parseError) {
      throw new LlmError("模型响应 JSON 解析失败。", "json_parse_failed", parseError);
    }
  }
}

export function parseLlmJson<TSchema extends z.ZodType>(
  text: string,
  schema: TSchema,
): z.infer<TSchema> {
  return schema.parse(extractJsonValue(text));
}

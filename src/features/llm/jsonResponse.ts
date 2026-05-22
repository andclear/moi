import type { z } from "zod";

import { LlmError } from "@/features/llm/llmTypes";

function stripJsonFence(text: string) {
  const fencedBlocks = [...text.matchAll(/```([a-zA-Z]*)\s*([\s\S]*?)```/g)];
  const jsonFence = fencedBlocks.find((match) => {
    const language = match[1]?.trim().toLowerCase();
    const content = match[2]?.trim() ?? "";
    return (!language || language === "json") && /^[{[]/.test(content);
  });

  return (jsonFence?.[2] ?? text).trim();
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

function normalizeJsonLikeText(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\bNone\b/g, "null")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/,\s*([}\]])/g, "$1");
}

function parseJsonWithRepair(source: string) {
  const candidates = [source, normalizeJsonLikeText(source)];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function extractJsonValue(text: string) {
  const source = stripJsonFence(text);

  try {
    return parseJsonWithRepair(source);
  } catch (error) {
    const bounds = findJsonBounds(source);
    if (!bounds) {
      throw new LlmError("模型响应中没有可解析的 JSON。", "json_not_found", error);
    }

    try {
      return parseJsonWithRepair(source.slice(bounds.start, bounds.end));
    } catch (parseError) {
      throw new LlmError("模型响应 JSON 解析失败。", "json_parse_failed", parseError);
    }
  }
}

export function parseLlmJson<TSchema extends z.ZodType>(
  text: string,
  schema: TSchema,
): z.infer<TSchema> {
  const result = schema.safeParse(extractJsonValue(text));
  if (!result.success) {
    throw new LlmError("模型响应 JSON 结构不符合预期。", "json_schema_invalid", result.error);
  }

  return result.data;
}

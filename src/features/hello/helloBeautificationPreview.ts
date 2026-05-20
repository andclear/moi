import type { Project } from "@/db/types";

export function hasHtmlLikeContent(content: string) {
  return /<style|<script|<[\w-]+[\s>]/i.test(content);
}

export function applyHelloBeautificationsForPreview(
  content: string,
  beautifications: Project["beautifications"],
) {
  let didReplace = false;
  const rendered = beautifications.reduce((result, asset) => {
    const nextResult = applySingleBeautification(result, asset);
    if (!nextResult.didReplace) {
      return result;
    }
    didReplace = true;
    return nextResult.content;
  }, content);

  return {
    content: rendered,
    didReplace,
  };
}

function applySingleBeautification(content: string, asset: Project["beautifications"][number]) {
  const candidates = createContentMatchCandidates(content);
  const regexCandidates = createRegexCandidates(asset.regex);

  for (const candidate of candidates) {
    for (const regex of regexCandidates) {
      try {
        const expression = createBeautificationRegex(regex);
        let didReplace = false;
        const nextContent = candidate.value.replace(expression, (...args: unknown[]) => {
          didReplace = true;
          const match = args[0];
          const hasNamedGroups =
            typeof args[args.length - 1] === "object" && args[args.length - 1] !== null;
          const groups = args.slice(1, hasNamedGroups ? -3 : -2);
          return interpolateRegexReplacement(asset.html, String(match), groups);
        });
        if (didReplace && nextContent !== candidate.value) {
          return {
            content: nextContent,
            didReplace: true,
          };
        }
      } catch {
        // 单条正则失败时继续尝试其他候选格式。
      }
    }
  }

  return {
    content,
    didReplace: false,
  };
}

function createContentMatchCandidates(content: string) {
  const strippedFence = stripMarkdownCodeFence(content);
  const decoded = decodeHtmlEntities(content);
  const decodedStrippedFence = stripMarkdownCodeFence(decoded);

  return Array.from(
    new Map(
      [content, strippedFence, decoded, decodedStrippedFence]
        .filter(Boolean)
        .map((value) => [value, { value }]),
    ).values(),
  );
}

function stripMarkdownCodeFence(content: string) {
  return content
    .trim()
    .replace(/^```(?:html|xml|text|txt)?\s*/i, "")
    .replace(/\s*```$/i, "");
}

function decodeHtmlEntities(content: string) {
  if (!/[&][a-zA-Z#0-9]+;/.test(content)) {
    return content;
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = content;
  return textarea.value;
}

function createRegexCandidates(regex: string) {
  const trimmed = regex.trim();
  const unescapedCommonTokens = trimmed.replace(/\\\\([sSdDwWbB])/g, "\\$1");
  return Array.from(new Set([trimmed, unescapedCommonTokens]));
}

function createBeautificationRegex(regex: string) {
  const parsed = parseRegexLiteral(regex.trim());
  const source = (parsed?.source ?? regex.trim()).replace(/^\(\?s\)/, "");
  const rawFlags = parsed?.flags ?? "";
  const flags = Array.from(new Set(`${rawFlags}gs`.split(""))).join("");
  return new RegExp(source, flags);
}

function parseRegexLiteral(value: string) {
  if (!value.startsWith("/")) {
    return null;
  }

  for (let index = value.length - 1; index > 0; index -= 1) {
    if (value[index] !== "/") {
      continue;
    }
    const slashPrefix = value.slice(0, index);
    const trailingBackslashes = slashPrefix.match(/\\+$/)?.[0].length ?? 0;
    if (trailingBackslashes % 2 === 1) {
      continue;
    }

    return {
      source: value.slice(1, index),
      flags: value.slice(index + 1).replace(/[^dgimsuvy]/g, ""),
    };
  }

  return null;
}

function interpolateRegexReplacement(template: string, match: string, groups: unknown[]) {
  return template.replace(/\$(\$|&|`|'|\d{1,2})/g, (token, key: string) => {
    if (key === "$") {
      return "$";
    }
    if (key === "&") {
      return match;
    }
    if (/^\d+$/.test(key)) {
      const value = groups[Number(key) - 1];
      return value == null ? "" : String(value);
    }
    return token;
  });
}

export type CharacterYamlValue = string | string[] | CharacterYamlObject;
export interface CharacterYamlObject {
  [key: string]: CharacterYamlValue;
}

interface ParsedLine {
  indent: number;
  content: string;
}

function stripComment(line: string) {
  let inQuote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== "\\") {
      inQuote = inQuote === char ? null : char;
      continue;
    }
    if (char === "#" && !inQuote) {
      return line.slice(0, index);
    }
  }
  return line;
}

function parseScalar(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  return trimmed;
}

function parseInlineArray(value: string) {
  const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!inner) {
    return [];
  }
  return inner.split(",").map((item) => parseScalar(item));
}

function findNextLine(lines: ParsedLine[], startIndex: number) {
  return lines.slice(startIndex + 1).find((line) => line.content.trim());
}

export function parseCharacterProfileYaml(yaml: string): CharacterYamlObject {
  const lines = yaml
    .split(/\r?\n/)
    .map((rawLine) => {
      const withoutComment = stripComment(rawLine).trimEnd();
      return {
        indent: withoutComment.match(/^\s*/)?.[0].length ?? 0,
        content: withoutComment.trim(),
      };
    })
    .filter((line) => line.content);

  const root: CharacterYamlObject = {};
  const stack: Array<{ indent: number; value: CharacterYamlObject | string[] }> = [
    { indent: -1, value: root },
  ];

  lines.forEach((line, index) => {
    while (stack.length > 1 && line.indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;
    if (line.content.startsWith("- ")) {
      if (Array.isArray(parent)) {
        parent.push(parseScalar(line.content.slice(2)));
      }
      return;
    }

    const separatorIndex = line.content.indexOf(":");
    if (separatorIndex < 0 || Array.isArray(parent)) {
      return;
    }

    const key = line.content.slice(0, separatorIndex).trim();
    const rawValue = line.content.slice(separatorIndex + 1).trim();
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      parent[key] = parseInlineArray(rawValue);
      return;
    }

    if (rawValue) {
      parent[key] = parseScalar(rawValue);
      return;
    }

    const nextLine = findNextLine(lines, index);
    const nextValue: CharacterYamlObject | string[] =
      nextLine && nextLine.indent > line.indent && nextLine.content.startsWith("- ")
        ? []
        : {};
    parent[key] = nextValue;
    stack.push({ indent: line.indent, value: nextValue });
  });

  return root;
}

function formatScalar(value: string) {
  return JSON.stringify(value);
}

function serializeValue(key: string, value: CharacterYamlValue, indent: number): string[] {
  const prefix = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${prefix}${key}: []`];
    }
    return [
      `${prefix}${key}:`,
      ...value.map((item) => `${" ".repeat(indent + 2)}- ${formatScalar(item)}`),
    ];
  }

  if (typeof value === "string") {
    return [`${prefix}${key}: ${formatScalar(value)}`];
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return [`${prefix}${key}: {}`];
  }

  return [
    `${prefix}${key}:`,
    ...entries.flatMap(([childKey, childValue]) => serializeValue(childKey, childValue, indent + 2)),
  ];
}

export function serializeCharacterProfileYaml(value: CharacterYamlObject) {
  return Object.entries(value)
    .flatMap(([key, childValue]) => serializeValue(key, childValue, 0))
    .join("\n");
}

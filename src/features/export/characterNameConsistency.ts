import type { HistorySnapshot, Project } from "@/db/types";
import { readCharacterNameFromYaml } from "@/features/greeting/greetingStore";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter((name) => name.length >= 2))];
}

function replaceNamesInValue<T>(value: T, aliases: string[], latestName: string): T {
  if (typeof value === "string") {
    return aliases.reduce(
      (current, alias) => current.replace(new RegExp(escapeRegExp(alias), "g"), latestName),
      value,
    ) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceNamesInValue(item, aliases, latestName)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [
        key,
        replaceNamesInValue(childValue, aliases, latestName),
      ]),
    ) as T;
  }

  return value;
}

export function collectPreviousCharacterNames(project: Project, histories: HistorySnapshot[]) {
  const latestName = readCharacterNameFromYaml(project.characterProfile?.yaml);
  if (!latestName) {
    return [];
  }

  return uniqueNames(
    histories
      .map((history) => readCharacterNameFromYaml(history.characterProfile?.yaml))
      .filter((name) => name && name !== latestName),
  );
}

export function normalizeExportCharacterNames(project: Project, histories: HistorySnapshot[]) {
  const latestName = readCharacterNameFromYaml(project.characterProfile?.yaml);
  if (!latestName) {
    return { project, replacedNames: [] };
  }

  const replacedNames = collectPreviousCharacterNames(project, histories);
  if (replacedNames.length === 0) {
    return { project, replacedNames };
  }

  return {
    project: replaceNamesInValue(structuredClone(project), replacedNames, latestName),
    replacedNames,
  };
}

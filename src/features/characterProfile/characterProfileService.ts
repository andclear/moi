import { projectRepository } from "@/db/repositories/projectRepository";
import type { CharacterProfileDocument } from "@/db/types";
import { generateCharacterProfileYaml } from "@/features/llm/llmClient";
import { collectPromptWorldEntries } from "@/features/world/worldPromptContext";
import { nowIso } from "@/shared/lib/date";

const MAX_RETRY_COUNT = 3;

function readTopLevelYamlValue(yaml: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escapedKey}:\\s*(.*)$`, "m").exec(yaml);
  if (!match) {
    return "";
  }

  return match[1].trim().replace(/^["']|["']$/g, "");
}

function readNestedYamlValue(yaml: string, parentKey: string, key: string) {
  const lines = yaml.split(/\r?\n/);
  const parentIndex = lines.findIndex((line) => line.trim() === `${parentKey}:`);
  if (parentIndex < 0) {
    return "";
  }

  for (const line of lines.slice(parentIndex + 1)) {
    if (line.trim() && !line.startsWith(" ")) {
      break;
    }
    const match = new RegExp(`^\\s{2}${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.*)$`).exec(line);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }

  return "";
}

function quoteYamlValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function replaceTopLevelYamlValue(yaml: string, key: string, value: string) {
  if (!value.trim()) {
    return yaml;
  }

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linePattern = new RegExp(`^${escapedKey}:\\s*.*$`, "m");
  const nextLine = `${key}: ${quoteYamlValue(value.trim())}`;
  if (linePattern.test(yaml)) {
    return yaml.replace(linePattern, nextLine);
  }

  return `${nextLine}\n${yaml}`;
}

function replaceNestedYamlValue(yaml: string, parentKey: string, key: string, value: string) {
  if (!value.trim()) {
    return yaml;
  }

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextLine = `  ${key}: ${quoteYamlValue(value.trim())}`;
  const lines = yaml.split(/\r?\n/);
  const parentIndex = lines.findIndex((line) => line.trim() === `${parentKey}:`);

  if (parentIndex < 0) {
    return `${parentKey}:\n${nextLine}\n${yaml}`;
  }

  let insertIndex = parentIndex + 1;
  for (let index = parentIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() && !line.startsWith(" ")) {
      break;
    }

    insertIndex = index + 1;
    if (new RegExp(`^\\s{2}${escapedKey}:\\s*.*$`).test(line)) {
      lines[index] = nextLine;
      return lines.join("\n");
    }
  }

  lines.splice(insertIndex, 0, nextLine);
  return lines.join("\n");
}

function preserveSavedIdentity(nextYaml: string, previousYaml: string) {
  const savedName = readTopLevelYamlValue(previousYaml, "姓名");
  const savedGender =
    readNestedYamlValue(previousYaml, "基本信息", "性别") || readTopLevelYamlValue(previousYaml, "性别");
  const savedAge =
    readNestedYamlValue(previousYaml, "基本信息", "年龄") || readTopLevelYamlValue(previousYaml, "年龄");

  return replaceNestedYamlValue(
    replaceNestedYamlValue(replaceTopLevelYamlValue(nextYaml, "姓名", savedName), "基本信息", "性别", savedGender),
    "基本信息",
    "年龄",
    savedAge,
  );
}

function createGeneratingState(retryCount: number, yaml = ""): CharacterProfileDocument {
  return {
    yaml,
    status: "generating",
    retryCount,
    errorMessage: undefined,
    updatedAt: nowIso(),
  };
}

async function updateCharacterProfile(projectId: string, characterProfile: CharacterProfileDocument) {
  return projectRepository.update(projectId, { characterProfile });
}

export async function generateAndSaveCharacterProfile(
  projectId: string,
  dossierMarkdown: string,
) {
  const existingProject = await projectRepository.getById(projectId);
  const previousYaml = existingProject?.characterProfile?.yaml ?? "";
  const confirmedWorldEntries = existingProject ? collectPromptWorldEntries(existingProject) : [];

  await updateCharacterProfile(projectId, createGeneratingState(0, previousYaml));

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt += 1) {
    await updateCharacterProfile(projectId, createGeneratingState(attempt, previousYaml));

    try {
      const result = await generateCharacterProfileYaml({
        projectId,
        characterProfile: dossierMarkdown,
        previousCharacterInfo: previousYaml,
        confirmedWorldEntries,
      });
      return updateCharacterProfile(projectId, {
        yaml: preserveSavedIdentity(result.yaml, previousYaml),
        status: "succeeded",
        retryCount: attempt,
        generationId: result.taskId,
        errorMessage: undefined,
        updatedAt: nowIso(),
      });
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : "角色信息生成失败。";
  return updateCharacterProfile(projectId, {
    yaml: previousYaml,
    status: "failed",
    retryCount: MAX_RETRY_COUNT,
    errorMessage: message,
    updatedAt: nowIso(),
  });
}

export async function saveCharacterProfileYaml(projectId: string, yaml: string) {
  const project = await projectRepository.getById(projectId);
  const previous = project?.characterProfile;

  return updateCharacterProfile(projectId, {
    yaml,
    status: "succeeded",
    retryCount: previous?.retryCount ?? 0,
    generationId: previous?.generationId,
    errorMessage: undefined,
    updatedAt: nowIso(),
  });
}

export const characterProfileRetryLimit = MAX_RETRY_COUNT;

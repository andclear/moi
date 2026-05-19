import { projectRepository } from "@/db/repositories/projectRepository";
import type { CharacterProfileDocument } from "@/db/types";
import { generateCharacterProfileYaml } from "@/features/llm/llmClient";
import { nowIso } from "@/shared/lib/date";

const MAX_RETRY_COUNT = 3;

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

  await updateCharacterProfile(projectId, createGeneratingState(0, previousYaml));

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt += 1) {
    await updateCharacterProfile(projectId, createGeneratingState(attempt, previousYaml));

    try {
      const result = await generateCharacterProfileYaml({
        projectId,
        characterProfile: dossierMarkdown,
      });
      return updateCharacterProfile(projectId, {
        yaml: result.yaml,
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

import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import type { DossierBlockMeta } from "@/db/types";
import { createProjectRepository } from "@/db/repositories/projectRepository";

export function createAutoSaveService(db: EchoDatabase = echoDb) {
  const projects = createProjectRepository(db);

  return {
    async saveDossierMarkdown(projectId: string, markdown: string, blocks?: DossierBlockMeta[]) {
      const project = await projects.updateDossier(projectId, markdown, blocks);
      if (!project) {
        throw new Error("无法保存不存在的项目。");
      }
      return project;
    },

    async saveCurrentStep(projectId: string, step: Parameters<typeof projects.updateCurrentStep>[1]) {
      const project = await projects.updateCurrentStep(projectId, step);
      if (!project) {
        throw new Error("无法更新不存在的项目步骤。");
      }
      return project;
    },
  };
}

export const autoSaveService = createAutoSaveService();

import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import { createHistoryRepository } from "@/db/repositories/historyRepository";
import type { HistorySnapshot, Project } from "@/db/types";
import { nowIso } from "@/shared/lib/date";

export function createHistoryService(db: EchoDatabase = echoDb) {
  const histories = createHistoryRepository(db);

  function applySnapshot(project: Project, snapshot: HistorySnapshot): Project {
    const now = nowIso();

    return {
      ...project,
      currentStep: snapshot.step,
      dossier: structuredClone(snapshot.dossier),
      worldEntries: structuredClone(snapshot.worldEntries),
      greetingVariants: structuredClone(snapshot.greetingVariants),
      trialRuns: structuredClone(snapshot.trialRuns),
      updatedAt: now,
    };
  }

  return {
    async createSnapshot(projectId: string, title: string, generationIds: string[] = []) {
      const project = await db.projects.get(projectId);
      if (!project) {
        throw new Error("无法为不存在的项目创建历史快照。");
      }

      return histories.create({ project, title, generationIds });
    },

    async restoreSnapshot(historyId: string) {
      const snapshot = await histories.getById(historyId);
      if (!snapshot) {
        throw new Error("无法恢复不存在的历史快照。");
      }

      const project = await db.projects.get(snapshot.projectId);
      if (!project) {
        throw new Error("历史快照对应的项目不存在。");
      }

      const restoredProject = applySnapshot(project, snapshot);
      await db.projects.put(restoredProject);
      return restoredProject;
    },
  };
}

export const historyService = createHistoryService();

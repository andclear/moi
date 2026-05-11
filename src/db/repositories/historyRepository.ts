import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import type { HistorySnapshot, Project } from "@/db/types";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export interface CreateHistoryInput {
  project: Project;
  title: string;
  generationIds?: string[];
}

export function createHistoryRepository(db: EchoDatabase = echoDb) {
  return {
    async create(input: CreateHistoryInput) {
      const snapshot: HistorySnapshot = {
        id: createId("history"),
        projectId: input.project.id,
        step: input.project.currentStep,
        title: input.title,
        dossier: structuredClone(input.project.dossier),
        worldEntries: structuredClone(input.project.worldEntries),
        greetingVariants: structuredClone(input.project.greetingVariants),
        trialRuns: structuredClone(input.project.trialRuns),
        beautifications: structuredClone(input.project.beautifications ?? []),
        companions: structuredClone(input.project.companions ?? []),
        companionRelations: structuredClone(input.project.companionRelations ?? []),
        profileSession: input.project.profileSession
          ? structuredClone(input.project.profileSession)
          : undefined,
        generationIds: input.generationIds ?? [],
        createdAt: nowIso(),
      };
      await db.histories.add(snapshot);
      return snapshot;
    },

    async getById(id: string) {
      return db.histories.get(id);
    },

    async listByProject(projectId: string) {
      return db.histories.where("projectId").equals(projectId).reverse().sortBy("createdAt");
    },

    async delete(id: string) {
      await db.histories.delete(id);
    },
  };
}

export const historyRepository = createHistoryRepository();

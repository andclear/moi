import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import type { GenerationStatus, GenerationTask, GenerationType, GenerationUsage } from "@/db/types";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export interface CreateGenerationInput {
  projectId: string;
  type: GenerationType;
  inputSummary: string;
  status?: GenerationStatus;
}

export function createGenerationRepository(db: EchoDatabase = echoDb) {
  return {
    async create(input: CreateGenerationInput) {
      const now = nowIso();
      const task: GenerationTask = {
        id: createId("generation"),
        projectId: input.projectId,
        type: input.type,
        status: input.status ?? "pending",
        inputSummary: input.inputSummary,
        createdAt: now,
        updatedAt: now,
      };
      await db.generations.add(task);
      return task;
    },

    async getById(id: string) {
      return db.generations.get(id);
    },

    async listByProject(projectId: string) {
      return db.generations.where("projectId").equals(projectId).reverse().sortBy("createdAt");
    },

    async markSucceeded(id: string, output: unknown, usage?: GenerationUsage) {
      await db.generations.update(id, {
        status: "succeeded",
        output,
        usage,
        updatedAt: nowIso(),
      });
      return db.generations.get(id);
    },

    async markFailed(id: string, errorMessage: string) {
      await db.generations.update(id, {
        status: "failed",
        errorMessage,
        updatedAt: nowIso(),
      });
      return db.generations.get(id);
    },

    async delete(id: string) {
      await db.generations.delete(id);
    },
  };
}

export const generationRepository = createGenerationRepository();

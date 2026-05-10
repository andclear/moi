import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import type { ExportFormat, ExportRecord } from "@/db/types";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export interface CreateExportInput {
  projectId: string;
  format: ExportFormat;
  jsonPreview: string;
  versionLabel?: string;
  note?: string;
  pngTextKey?: string;
}

export function createExportRepository(db: EchoDatabase = echoDb) {
  return {
    async create(input: CreateExportInput) {
      const record: ExportRecord = {
        id: createId("export"),
        createdAt: nowIso(),
        ...input,
      };
      await db.exports.add(record);
      return record;
    },

    async listByProject(projectId: string) {
      return db.exports.where("projectId").equals(projectId).reverse().sortBy("createdAt");
    },

    async getById(id: string) {
      return db.exports.get(id);
    },

    async delete(id: string) {
      await db.exports.delete(id);
    },
  };
}

export const exportRepository = createExportRepository();

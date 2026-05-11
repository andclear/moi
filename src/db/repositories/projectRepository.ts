import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import { createProjectDraft } from "@/db/defaults";
import type { DossierBlockMeta, Project } from "@/db/types";
import type { FlowStepId } from "@/features/flow/flowStore";
import { nowIso } from "@/shared/lib/date";

export interface CreateProjectInput {
  title?: string;
  dossierMarkdown?: string;
}

export function createProjectRepository(db: EchoDatabase = echoDb) {
  return {
    async create(input: CreateProjectInput = {}) {
      const project = createProjectDraft(input);
      await db.projects.add(project);
      return project;
    },

    async getById(id: string) {
      return db.projects.get(id);
    },

    async listActive() {
      const projects = await db.projects.orderBy("updatedAt").reverse().toArray();
      return projects.filter((project) => !project.archivedAt);
    },

    async listAll() {
      return db.projects.orderBy("updatedAt").reverse().toArray();
    },

    async update(id: string, patch: Partial<Omit<Project, "id" | "createdAt">>) {
      const updatedAt = nowIso();
      await db.projects.update(id, { ...patch, updatedAt });
      return db.projects.get(id);
    },

    async updateCurrentStep(id: string, currentStep: FlowStepId) {
      return this.update(id, { currentStep });
    },

    async getCurrent() {
      const activeProjects = await this.listActive();
      return activeProjects[0];
    },

    async updateDossier(id: string, markdown: string, blocks?: DossierBlockMeta[]) {
      const project = await db.projects.get(id);
      if (!project) {
        return undefined;
      }

      const updatedAt = nowIso();
      const nextProject: Project = {
        ...project,
        dossier: {
          markdown,
          blocks: blocks ?? project.dossier.blocks,
          updatedAt,
        },
        updatedAt,
      };

      await db.projects.put(nextProject);
      return nextProject;
    },

    async delete(id: string) {
      await db.transaction("rw", db.projects, db.histories, db.generations, db.exports, async () => {
        await db.projects.delete(id);
        await db.histories.where("projectId").equals(id).delete();
        await db.generations.where("projectId").equals(id).delete();
        await db.exports.where("projectId").equals(id).delete();
      });
    },
  };
}

export const projectRepository = createProjectRepository();

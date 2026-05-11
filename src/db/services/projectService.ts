import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import { createProjectRepository } from "@/db/repositories/projectRepository";
import type { ProfileSession, Project } from "@/db/types";
import { createDefaultDossierMarkdown } from "@/features/dossier/dossierSections";

function createInitialDossierMarkdown(brief: string) {
  return createDefaultDossierMarkdown(brief.trim() || "尚未听见");
}

function createTitleFromBrief(brief: string) {
  const normalizedBrief = brief.trim().replace(/\s+/g, " ");
  if (!normalizedBrief) {
    return "未命名的回音";
  }

  return normalizedBrief.length > 18 ? `${normalizedBrief.slice(0, 18)}…` : normalizedBrief;
}

export function createProjectService(db: EchoDatabase = echoDb) {
  const projects = createProjectRepository(db);

  return {
    async createFromInitialBrief(brief: string) {
      const project = await projects.create({
        title: createTitleFromBrief(brief),
        dossierMarkdown: createInitialDossierMarkdown(brief),
      });

      const updatedProject = await projects.updateCurrentStep(project.id, "profile");
      if (!updatedProject) {
        throw new Error("无法进入下一阶段。");
      }

      return updatedProject;
    },

    async listActiveProjects() {
      return projects.listActive();
    },

    async resolveProject(projectId?: string) {
      if (projectId && projectId !== "current") {
        return projects.getById(projectId);
      }

      return projects.getCurrent();
    },

    async updateProfileSession(projectId: string, profileSession: ProfileSession) {
      return projects.update(projectId, { profileSession });
    },

    async updateProject(projectId: string, patch: Partial<Omit<Project, "id" | "createdAt">>) {
      return projects.update(projectId, patch);
    },
  };
}

export const projectService = createProjectService();

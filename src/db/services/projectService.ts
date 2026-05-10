import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import { createProjectRepository } from "@/db/repositories/projectRepository";

function createInitialDossierMarkdown(brief: string) {
  const normalizedBrief = brief.trim() || "尚未听见";

  return [
    "## 最初的回音",
    "",
    normalizedBrief,
    "",
    "## TA 的本心",
    "",
    "尚未听见",
    "",
    "## 外貌特征",
    "",
    "尚未听见",
    "",
    "## 背景故事",
    "",
    "尚未听见",
    "",
    "## 核心矛盾",
    "",
    "尚未听见",
    "",
    "## 说话风格",
    "",
    "尚未听见",
    "",
    "## TA 所在的世界",
    "",
    "尚未听见",
    "",
    "## 开场白",
    "",
    "尚未听见",
  ].join("\n");
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
  };
}

export const projectService = createProjectService();

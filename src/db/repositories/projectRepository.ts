import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import { createProjectDraft } from "@/db/defaults";
import type { DossierBlockMeta, Project } from "@/db/types";
import type { FlowStepId } from "@/features/flow/flowStore";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

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

    async copy(id: string, title?: string) {
      const project = await db.projects.get(id);
      if (!project) {
        throw new Error("无法复制不存在的档案。");
      }

      const now = nowIso();
      const nextProject: Project = {
        ...structuredClone(project),
        id: createId("project"),
        title: title ?? `${project.title} 副本`,
        createdAt: now,
        updatedAt: now,
        archivedAt: undefined,
        worldEntries: project.worldEntries.map((entry) => ({
          ...entry,
          id: createId("world"),
          projectId: "",
          createdAt: now,
          updatedAt: now,
        })),
        greetingVariants: project.greetingVariants.map((variant) => ({
          ...variant,
          id: createId("greeting"),
          projectId: "",
          createdAt: now,
          updatedAt: now,
        })),
        trialRuns: project.trialRuns.map((trial) => ({
          ...trial,
          id: createId("trial"),
          projectId: "",
          createdAt: now,
        })),
        beautifications: (project.beautifications ?? []).map((asset) => ({
          ...asset,
          id: createId("beauty"),
          projectId: "",
          createdAt: now,
          updatedAt: now,
        })),
        companions: (project.companions ?? []).map((node) => ({
          ...node,
          id: createId("npc"),
          projectId: "",
          createdAt: now,
          updatedAt: now,
        })),
        companionRelations: [],
      };

      const companionIdMap = new Map<string, string>();
      project.companions?.forEach((node, index) => {
        companionIdMap.set(node.id, nextProject.companions[index]?.id ?? node.id);
      });

      nextProject.worldEntries = nextProject.worldEntries.map((entry) => ({
        ...entry,
        projectId: nextProject.id,
      }));
      nextProject.greetingVariants = nextProject.greetingVariants.map((variant) => ({
        ...variant,
        projectId: nextProject.id,
      }));
      nextProject.trialRuns = nextProject.trialRuns.map((trial) => ({
        ...trial,
        projectId: nextProject.id,
      }));
      nextProject.beautifications = nextProject.beautifications.map((asset) => ({
        ...asset,
        projectId: nextProject.id,
      }));
      nextProject.companions = nextProject.companions.map((node) => ({
        ...node,
        projectId: nextProject.id,
      }));
      nextProject.companionRelations = (project.companionRelations ?? []).map((relation) => ({
        ...relation,
        id: createId("relation"),
        projectId: nextProject.id,
        fromNodeId: companionIdMap.get(relation.fromNodeId) ?? relation.fromNodeId,
        toNodeId: companionIdMap.get(relation.toNodeId) ?? relation.toNodeId,
        createdAt: now,
        updatedAt: now,
      }));

      await db.projects.add(nextProject);
      return nextProject;
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

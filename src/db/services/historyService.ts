import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import { createHistoryRepository } from "@/db/repositories/historyRepository";
import type { HistorySnapshot, Project } from "@/db/types";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

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
      beautifications: structuredClone(snapshot.beautifications ?? []),
      companions: structuredClone(snapshot.companions ?? []),
      companionRelations: structuredClone(snapshot.companionRelations ?? []),
      profileSession: snapshot.profileSession ? structuredClone(snapshot.profileSession) : project.profileSession,
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

    async listProjectSnapshots(projectId: string) {
      return histories.listByProject(projectId);
    },

    async copySnapshot(historyId: string) {
      const snapshot = await histories.getById(historyId);
      if (!snapshot) {
        throw new Error("无法复制不存在的历史节点。");
      }

      const project = await db.projects.get(snapshot.projectId);
      if (!project) {
        throw new Error("历史节点对应的原档案不存在。");
      }

      const now = nowIso();
      const nextProject: Project = {
        ...project,
        id: createId("project"),
        title: `${project.title} 历史版本`,
        currentStep: snapshot.step,
        dossier: structuredClone(snapshot.dossier),
        worldEntries: structuredClone(snapshot.worldEntries),
        greetingVariants: structuredClone(snapshot.greetingVariants),
        trialRuns: structuredClone(snapshot.trialRuns),
        beautifications: structuredClone(snapshot.beautifications ?? []),
        companions: structuredClone(snapshot.companions ?? []),
        companionRelations: structuredClone(snapshot.companionRelations ?? []),
        profileSession: snapshot.profileSession ? structuredClone(snapshot.profileSession) : undefined,
        createdAt: now,
        updatedAt: now,
        archivedAt: undefined,
      };

      nextProject.worldEntries = nextProject.worldEntries.map((entry) => ({
        ...entry,
        id: createId("world"),
        projectId: nextProject.id,
        createdAt: now,
        updatedAt: now,
      }));
      nextProject.greetingVariants = nextProject.greetingVariants.map((variant) => ({
        ...variant,
        id: createId("greeting"),
        projectId: nextProject.id,
        createdAt: now,
        updatedAt: now,
      }));
      nextProject.trialRuns = nextProject.trialRuns.map((trial) => ({
        ...trial,
        id: createId("trial"),
        projectId: nextProject.id,
        createdAt: now,
      }));
      nextProject.beautifications = nextProject.beautifications.map((asset) => ({
        ...asset,
        id: createId("beauty"),
        projectId: nextProject.id,
        createdAt: now,
        updatedAt: now,
      }));
      const companionIdMap = new Map<string, string>();
      nextProject.companions = nextProject.companions.map((node) => {
        const nextId = createId("npc");
        companionIdMap.set(node.id, nextId);
        return {
          ...node,
          id: nextId,
          projectId: nextProject.id,
          createdAt: now,
          updatedAt: now,
        };
      });
      nextProject.companionRelations = nextProject.companionRelations.map((relation) => ({
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
  };
}

export const historyService = createHistoryService();

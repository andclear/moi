import { create } from "zustand";

import type { DossierBlockMeta, Project } from "@/db/types";
import { projectRepository } from "@/db/repositories/projectRepository";
import { autoSaveService } from "@/db/services/autoSaveService";
import { nowIso } from "@/shared/lib/date";
import {
  buildDossierBlockMeta,
  mergeAiDossierWithLocks,
  setDossierSectionLock,
} from "@/features/dossier/dossierSections";

export type DossierSaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

interface DossierState {
  projectId: string | null;
  markdown: string;
  blocks: DossierBlockMeta[];
  saveStatus: DossierSaveStatus;
  errorMessage: string | null;
  loadProject: (projectId: string) => Promise<void>;
  hydrateFromProject: (project: Project) => void;
  updateMarkdown: (markdown: string) => Promise<void>;
  toggleSectionLock: (section: string) => Promise<void>;
  applyAiMarkdown: (markdown: string, generationId?: string) => Promise<void>;
  reset: () => void;
}

async function saveDossier(projectId: string, markdown: string, blocks: DossierBlockMeta[]) {
  return autoSaveService.saveDossierMarkdown(projectId, markdown, blocks);
}

export const useDossierStore = create<DossierState>((set, get) => ({
  projectId: null,
  markdown: "",
  blocks: [],
  saveStatus: "idle",
  errorMessage: null,

  async loadProject(projectId) {
    set({ saveStatus: "loading", errorMessage: null });
    const project = await projectRepository.getById(projectId);
    if (!project) {
      set({ saveStatus: "error", errorMessage: "没有找到这份回音档案。" });
      return;
    }

    const now = nowIso();
    const blocks =
      project.dossier.blocks.length > 0
        ? project.dossier.blocks
        : buildDossierBlockMeta(project.dossier.markdown, [], "ai_inferred", now);

    set({
      projectId,
      markdown: project.dossier.markdown,
      blocks,
      saveStatus: "saved",
      errorMessage: null,
    });
  },

  hydrateFromProject(project) {
    const now = nowIso();
    const blocks =
      project.dossier.blocks.length > 0
        ? project.dossier.blocks
        : buildDossierBlockMeta(project.dossier.markdown, [], "ai_inferred", now);

    set({
      projectId: project.id,
      markdown: project.dossier.markdown,
      blocks,
      saveStatus: "saved",
      errorMessage: null,
    });
  },

  async updateMarkdown(markdown) {
    const { projectId, blocks } = get();
    if (!projectId) {
      set({ markdown });
      return;
    }

    const nextBlocks = buildDossierBlockMeta(markdown, blocks, "user_confirmed", nowIso());
    set({ markdown, blocks: nextBlocks, saveStatus: "saving", errorMessage: null });

    try {
      await saveDossier(projectId, markdown, nextBlocks);
      set({ saveStatus: "saved" });
    } catch (error) {
      set({
        saveStatus: "error",
        errorMessage: error instanceof Error ? error.message : "档案保存失败。",
      });
    }
  },

  async toggleSectionLock(section) {
    const { projectId, markdown, blocks } = get();
    const existing = blocks.find((block) => block.section === section);
    const nextBlocks = setDossierSectionLock(blocks, section, !existing?.locked, nowIso());

    set({ blocks: nextBlocks, saveStatus: "saving", errorMessage: null });
    if (!projectId) {
      set({ saveStatus: "saved" });
      return;
    }

    try {
      await saveDossier(projectId, markdown, nextBlocks);
      set({ saveStatus: "saved" });
    } catch (error) {
      set({
        saveStatus: "error",
        errorMessage: error instanceof Error ? error.message : "锁定状态保存失败。",
      });
    }
  },

  async applyAiMarkdown(markdown, generationId) {
    const { projectId, markdown: currentMarkdown, blocks } = get();
    if (!projectId) {
      return;
    }

    const mergedMarkdown = mergeAiDossierWithLocks(currentMarkdown, blocks, markdown);
    const nextBlocks = buildDossierBlockMeta(
      mergedMarkdown,
      blocks,
      "ai_inferred",
      nowIso(),
      generationId,
    );

    set({
      markdown: mergedMarkdown,
      blocks: nextBlocks,
      saveStatus: "saving",
      errorMessage: null,
    });

    try {
      await saveDossier(projectId, mergedMarkdown, nextBlocks);
      set({ saveStatus: "saved" });
    } catch (error) {
      set({
        saveStatus: "error",
        errorMessage: error instanceof Error ? error.message : "AI 档案更新保存失败。",
      });
    }
  },

  reset() {
    set({
      projectId: null,
      markdown: "",
      blocks: [],
      saveStatus: "idle",
      errorMessage: null,
    });
  },
}));

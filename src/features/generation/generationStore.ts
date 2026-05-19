import { create } from "zustand";

import type { GenerationTask } from "@/db/types";
import { generationRepository } from "@/db/repositories/generationRepository";

export type GenerationTaskState = {
  status: "idle" | GenerationTask["status"];
  taskId?: string;
  errorMessage?: string;
};

interface GenerationState {
  tasks: Record<string, GenerationTaskState>;
  controllers: Record<string, AbortController>;
  setRunning: (key: string, controller: AbortController, taskId?: string) => void;
  setSucceeded: (key: string, taskId?: string) => void;
  setFailed: (key: string, message: string, taskId?: string) => void;
  cancel: (key: string) => void;
  loadProjectTasks: (projectId: string) => Promise<GenerationTask[]>;
  getTask: (key: string) => GenerationTaskState;
}

const idleTask: GenerationTaskState = { status: "idle" };

function removeController(
  controllers: Record<string, AbortController>,
  key: string,
): Record<string, AbortController> {
  return Object.fromEntries(Object.entries(controllers).filter(([controllerKey]) => controllerKey !== key));
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  tasks: {},
  controllers: {},

  setRunning(key, controller, taskId) {
    get().controllers[key]?.abort();
    set((state) => ({
      tasks: { ...state.tasks, [key]: { status: "running", taskId } },
      controllers: { ...state.controllers, [key]: controller },
    }));
  },

  setSucceeded(key, taskId) {
    set((state) => {
      return {
        tasks: { ...state.tasks, [key]: { status: "succeeded", taskId } },
        controllers: removeController(state.controllers, key),
      };
    });
  },

  setFailed(key, message, taskId) {
    set((state) => {
      return {
        tasks: { ...state.tasks, [key]: { status: "failed", taskId, errorMessage: message } },
        controllers: removeController(state.controllers, key),
      };
    });
  },

  cancel(key) {
    const controller = get().controllers[key];
    controller?.abort();
    set((state) => {
      return {
        tasks: { ...state.tasks, [key]: { status: "cancelled" } },
        controllers: removeController(state.controllers, key),
      };
    });
  },

  async loadProjectTasks(projectId) {
    return generationRepository.listByProject(projectId);
  },

  getTask(key) {
    return get().tasks[key] ?? idleTask;
  },
}));

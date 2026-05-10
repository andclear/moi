import { create } from "zustand";

export type FlowStepId = "post" | "profile" | "world" | "greeting" | "trial" | "export";

interface FlowState {
  currentStepId: FlowStepId;
  completedStepIds: FlowStepId[];
  setCurrentStep: (stepId: FlowStepId) => void;
  markStepCompleted: (stepId: FlowStepId) => void;
}

export const useFlowStore = create<FlowState>((set) => ({
  currentStepId: "post",
  completedStepIds: [],
  setCurrentStep: (stepId) => set({ currentStepId: stepId }),
  markStepCompleted: (stepId) =>
    set((state) => ({
      completedStepIds: state.completedStepIds.includes(stepId)
        ? state.completedStepIds
        : [...state.completedStepIds, stepId],
    })),
}));

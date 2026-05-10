import { create } from "zustand";

type WorkspacePanel = "dossier" | "api" | null;

interface UiState {
  activePanel: WorkspacePanel;
  isSidebarOpen: boolean;
  isModalOpen: boolean;
  openPanel: (panel: Exclude<WorkspacePanel, null>) => void;
  closePanel: () => void;
  toggleSidebar: () => void;
  setModalOpen: (isOpen: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: null,
  isSidebarOpen: false,
  isModalOpen: false,
  openPanel: (panel) => set({ activePanel: panel, isSidebarOpen: true }),
  closePanel: () => set({ activePanel: null, isSidebarOpen: false }),
  toggleSidebar: () =>
    set((state) => {
      if (state.isSidebarOpen) {
        return { activePanel: null, isSidebarOpen: false };
      }

      return { activePanel: state.activePanel ?? "dossier", isSidebarOpen: true };
    }),
  setModalOpen: (isOpen) => set({ isModalOpen: isOpen }),
}));

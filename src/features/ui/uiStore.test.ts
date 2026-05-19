import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "@/features/ui/uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUiStore.setState({
      activePanel: null,
      isSidebarOpen: false,
      isModalOpen: false,
    });
  });

  it("打开角色记录面板时同步展开侧边栏", () => {
    useUiStore.getState().openPanel("dossier");

    expect(useUiStore.getState().activePanel).toBe("dossier");
    expect(useUiStore.getState().isSidebarOpen).toBe(true);
  });

  it("打开 API 面板时保持侧边栏展开并替换内容", () => {
    useUiStore.getState().openPanel("dossier");
    useUiStore.getState().openPanel("api");

    expect(useUiStore.getState().activePanel).toBe("api");
    expect(useUiStore.getState().isSidebarOpen).toBe(true);
  });

  it("关闭侧边栏时清空当前面板", () => {
    useUiStore.getState().openPanel("api");
    useUiStore.getState().closePanel();

    expect(useUiStore.getState().activePanel).toBeNull();
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });

  it("toggleSidebar 从关闭变打开时默认打开角色记录", () => {
    useUiStore.getState().toggleSidebar();

    expect(useUiStore.getState().activePanel).toBe("dossier");
    expect(useUiStore.getState().isSidebarOpen).toBe(true);
  });

  it("toggleSidebar 从打开变关闭时清空当前面板", () => {
    useUiStore.getState().openPanel("api");
    useUiStore.getState().toggleSidebar();

    expect(useUiStore.getState().activePanel).toBeNull();
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });
});

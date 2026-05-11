import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGenerationStore } from "@/features/generation/generationStore";

describe("generationStore", () => {
  beforeEach(() => {
    useGenerationStore.setState({ tasks: {}, controllers: {} });
  });

  it("多个生成任务状态互不污染", () => {
    const firstController = new AbortController();
    const secondController = new AbortController();

    useGenerationStore.getState().setRunning("profile", firstController, "generation_1");
    useGenerationStore.getState().setRunning("world", secondController, "generation_2");
    useGenerationStore.getState().setSucceeded("profile", "generation_1");

    expect(useGenerationStore.getState().getTask("profile")).toMatchObject({
      status: "succeeded",
      taskId: "generation_1",
    });
    expect(useGenerationStore.getState().getTask("world")).toMatchObject({
      status: "running",
      taskId: "generation_2",
    });
  });

  it("取消任务时调用 AbortController 并恢复可重试状态", () => {
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, "abort");

    useGenerationStore.getState().setRunning("profile", controller);
    useGenerationStore.getState().cancel("profile");

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(useGenerationStore.getState().getTask("profile").status).toBe("cancelled");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { echoDb } from "@/db/db";
import { activationRepository } from "@/db/repositories/activationRepository";
import { useActivationStore } from "@/features/activation/activationStore";

async function resetActivationState() {
  await echoDb.activations.clear();
  useActivationStore.setState({ activation: null, status: "idle", errorMessage: null });
  vi.restoreAllMocks();
}

describe("activationStore", () => {
  beforeEach(async () => {
    await resetActivationState();
  });

  afterEach(async () => {
    await resetActivationState();
  });

  it("加载无限时长与无限次数的服务端有效会话后保持 active", async () => {
    await activationRepository.save({
      status: "active",
      activatedAt: "2026-05-21T00:00:00.000Z",
      sessionToken: "session",
      availableModel: "preset-model",
      usageLimit: 0,
      usageCount: 0,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "active",
          availableModel: "preset-model",
          usageLimit: 0,
          usageCount: 12,
        }),
      ),
    );

    await useActivationStore.getState().load();

    expect(useActivationStore.getState().status).toBe("active");
    expect(useActivationStore.getState().activation).toMatchObject({
      status: "active",
      usageLimit: 0,
      usageCount: 12,
    });
  });

  it("服务端返回过期时同步本地状态", async () => {
    await activationRepository.save({
      status: "active",
      activatedAt: "2026-05-21T00:00:00.000Z",
      sessionToken: "session",
      availableModel: "preset-model",
      usageLimit: 10,
      usageCount: 10,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "expired",
          availableModel: "preset-model",
          usageLimit: 10,
          usageCount: 10,
        }),
      ),
    );

    await useActivationStore.getState().load();

    expect(useActivationStore.getState().status).toBe("expired");
    expect(useActivationStore.getState().activation?.status).toBe("expired");
  });

  it("服务端校验失败时保留本地状态并记录错误", async () => {
    await activationRepository.save({
      status: "active",
      activatedAt: "2026-05-21T00:00:00.000Z",
      sessionToken: "session",
      availableModel: "preset-model",
      usageLimit: 0,
      usageCount: 1,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));

    await useActivationStore.getState().load();

    expect(useActivationStore.getState().status).toBe("active");
    expect(useActivationStore.getState().activation?.status).toBe("active");
    expect(useActivationStore.getState().errorMessage).toBe("激活状态校验失败。");
  });

  it("本地没有 sessionToken 时不请求服务端", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await useActivationStore.getState().load();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useActivationStore.getState().status).toBe("idle");
  });
});

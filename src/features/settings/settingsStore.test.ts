import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { echoDb } from "@/db/db";
import { activationRepository } from "@/db/repositories/activationRepository";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import { useActivationStore } from "@/features/activation/activationStore";
import { useModelChannelStore } from "@/features/activation/modelChannelStore";
import { defaultApiSettings, useSettingsStore } from "@/features/settings/settingsStore";

async function clearLocalState() {
  await echoDb.settings.clear();
  await echoDb.activations.clear();
  useSettingsStore.setState({ apiSettings: null, status: "idle", errorMessage: null });
  useModelChannelStore.setState({ channel: { presetEnabled: false }, status: "idle" });
  useActivationStore.setState({ activation: null, status: "idle", errorMessage: null });
}

describe("settingsStore", () => {
  beforeEach(async () => {
    await clearLocalState();
  });

  afterEach(async () => {
    await clearLocalState();
  });

  it("自定义渠道信息完整时可用", async () => {
    await settingsRepository.saveApiSettings({
      ...defaultApiSettings,
      mode: "custom",
      apiBaseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "custom-model",
    });

    await useSettingsStore.getState().load();

    expect(useSettingsStore.getState().getAvailability()).toMatchObject({
      available: true,
      mode: "custom",
      model: "custom-model",
    });
  });

  it("选择自定义渠道但缺少模型时不可用", async () => {
    await settingsRepository.saveApiSettings({
      ...defaultApiSettings,
      mode: "custom",
      apiBaseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "",
    });

    await useSettingsStore.getState().load();

    expect(useSettingsStore.getState().getAvailability()).toMatchObject({
      available: false,
      mode: "custom",
      reason: "自配 API 信息不完整",
    });
  });

  it("旧版暂不连接设置会按自定义渠道读取", async () => {
    await settingsRepository.saveApiSettings({
      ...defaultApiSettings,
      mode: "none",
    });

    await useSettingsStore.getState().load();

    expect(useSettingsStore.getState().apiSettings).toMatchObject({
      mode: "custom",
    });
    expect(useSettingsStore.getState().getAvailability()).toMatchObject({
      available: false,
      mode: "custom",
      reason: "自配 API 信息不完整",
    });
  });

  it("选择预置渠道时必须存在有效激活状态", async () => {
    await settingsRepository.saveApiSettings({
      ...defaultApiSettings,
      mode: "preset",
      model: "custom-model",
    });
    useModelChannelStore.setState({ channel: { presetEnabled: true, model: "preset-model" } });

    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().getAvailability()).toMatchObject({
      available: false,
      mode: "preset",
      reason: "预置调用尚未激活",
    });

    const activation = await activationRepository.save({
      status: "active",
      activatedAt: "2026-05-21T00:00:00.000Z",
      sessionToken: "session",
      availableModel: "preset-model",
      usageLimit: 0,
      usageCount: 8,
    });
    useActivationStore.setState({ activation, status: "active" });

    expect(useSettingsStore.getState().getAvailability()).toMatchObject({
      available: true,
      mode: "preset",
      model: "preset-model",
    });
  });
});

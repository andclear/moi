import { create } from "zustand";

import type { ApiSettings } from "@/db/types";
import { settingsRepository } from "@/db/repositories/settingsRepository";

export type ApiAvailability =
  | { available: false; reason: string; mode: "none" | "custom" | "preset" }
  | { available: true; label: string; model: string; mode: "custom" | "preset" };

export const defaultApiSettings: Omit<ApiSettings, "id" | "updatedAt"> = {
  mode: "none",
  apiBaseUrl: "",
  apiKey: "",
  model: "",
  temperature: 0.7,
  supportsSystemPrompt: true,
};

interface SettingsState {
  apiSettings: ApiSettings | null;
  status: "idle" | "loading" | "saving" | "saved" | "error";
  errorMessage: string | null;
  load: () => Promise<void>;
  saveApiSettings: (settings: Omit<ApiSettings, "id" | "updatedAt">) => Promise<ApiSettings>;
  getAvailability: () => ApiAvailability;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiSettings: null,
  status: "idle",
  errorMessage: null,

  async load() {
    set({ status: "loading", errorMessage: null });
    try {
      const apiSettings = await settingsRepository.getApiSettings();
      set({ apiSettings: apiSettings ?? null, status: "saved" });
    } catch (error) {
      set({
        status: "error",
        errorMessage: error instanceof Error ? error.message : "设置读取失败。",
      });
    }
  },

  async saveApiSettings(settings) {
    set({ status: "saving", errorMessage: null });
    try {
      const saved = await settingsRepository.saveApiSettings(settings);
      set({ apiSettings: saved, status: "saved" });
      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : "设置保存失败。";
      set({ status: "error", errorMessage: message });
      throw new Error(message);
    }
  },

  getAvailability() {
    const settings = get().apiSettings;
    if (!settings || settings.mode === "none") {
      return { available: false, reason: "尚未连接模型", mode: "none" };
    }

    if (settings.mode === "custom") {
      if (!settings.apiBaseUrl || !settings.apiKey || !settings.model) {
        return { available: false, reason: "自配 API 信息不完整", mode: "custom" };
      }
      return {
        available: true,
        label: "自配接口已就绪",
        model: settings.model,
        mode: "custom",
      };
    }

    return {
      available: true,
      label: "预置调用已就绪",
      model: settings.model || "预置模型",
      mode: "preset",
    };
  },
}));

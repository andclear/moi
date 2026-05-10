import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import type { ApiSettings, SettingsRecord } from "@/db/types";
import { nowIso } from "@/shared/lib/date";

const API_SETTINGS_KEY = "api";

export function createSettingsRepository(db: EchoDatabase = echoDb) {
  return {
    async get<T = unknown>(key: string) {
      const record = await db.settings.get(key);
      return record?.value as T | undefined;
    },

    async set(key: string, value: unknown) {
      const record: SettingsRecord = { key, value, updatedAt: nowIso() };
      await db.settings.put(record);
      return record;
    },

    async getApiSettings() {
      return this.get<ApiSettings>(API_SETTINGS_KEY);
    },

    async saveApiSettings(value: Omit<ApiSettings, "id" | "updatedAt">) {
      const settings: ApiSettings = { ...value, id: API_SETTINGS_KEY, updatedAt: nowIso() };
      await this.set(API_SETTINGS_KEY, settings);
      return settings;
    },

    async delete(key: string) {
      await db.settings.delete(key);
    },
  };
}

export const settingsRepository = createSettingsRepository();

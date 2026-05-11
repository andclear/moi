import { create } from "zustand";

import type { ActivationRecord } from "@/db/types";
import { activationRepository } from "@/db/repositories/activationRepository";

interface ActivateResponse {
  sessionToken: string;
  expiresAt: string;
  availableModel: string;
  usageLimit?: number;
  usageCount?: number;
}

interface ActivationState {
  activation: ActivationRecord | null;
  status: "idle" | "loading" | "activating" | "active" | "expired" | "error";
  errorMessage: string | null;
  load: () => Promise<void>;
  activate: (code: string) => Promise<ActivationRecord>;
  clear: () => Promise<void>;
}

function resolveStatus(record: ActivationRecord | null): ActivationState["status"] {
  if (!record) {
    return "idle";
  }
  if (record.status !== "active") {
    return record.status === "expired" ? "expired" : "idle";
  }
  if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
    return "expired";
  }
  return "active";
}

export const useActivationStore = create<ActivationState>((set) => ({
  activation: null,
  status: "idle",
  errorMessage: null,

  async load() {
    set({ status: "loading", errorMessage: null });
    const activation = await activationRepository.getCurrent();
    set({ activation: activation ?? null, status: resolveStatus(activation ?? null) });
  },

  async activate(code) {
    set({ status: "activating", errorMessage: null });
    try {
      const response = await fetch("/api/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "激活失败。");
      }

      const payload = (await response.json()) as ActivateResponse;
      const activation = await activationRepository.save({
        status: "active",
        activatedAt: new Date().toISOString(),
        expiresAt: payload.expiresAt,
        sessionToken: payload.sessionToken,
        availableModel: payload.availableModel,
        usageLimit: payload.usageLimit,
        usageCount: payload.usageCount ?? 0,
      });
      set({ activation, status: "active" });
      return activation;
    } catch (error) {
      const message = error instanceof Error ? error.message : "激活失败。";
      set({ status: "error", errorMessage: message });
      throw new Error(message);
    }
  },

  async clear() {
    await activationRepository.clear();
    set({ activation: null, status: "idle", errorMessage: null });
  },
}));

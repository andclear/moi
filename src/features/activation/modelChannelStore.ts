import { create } from "zustand";

interface PublicModelChannelStatus {
  presetEnabled: boolean;
  model?: string;
}

interface ModelChannelState {
  channel: PublicModelChannelStatus;
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<PublicModelChannelStatus>;
}

const disabledChannel: PublicModelChannelStatus = { presetEnabled: false };

export const useModelChannelStore = create<ModelChannelState>((set) => ({
  channel: disabledChannel,
  status: "idle",

  async load() {
    set({ status: "loading" });
    try {
      const response = await fetch("/api/model-channel/status");
      if (!response.ok) {
        throw new Error("预置渠道状态读取失败。");
      }
      const channel = (await response.json()) as PublicModelChannelStatus;
      set({ channel, status: "ready" });
      return channel;
    } catch {
      set({ channel: disabledChannel, status: "error" });
      return disabledChannel;
    }
  },
}));

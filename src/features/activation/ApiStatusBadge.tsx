import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect } from "react";

import { useActivationStore } from "@/features/activation/activationStore";
import { useModelChannelStore } from "@/features/activation/modelChannelStore";
import { useSettingsStore } from "@/features/settings/settingsStore";

export function ApiStatusBadge() {
  const { apiSettings, load: loadSettings, getAvailability } = useSettingsStore();
  const { activation, load: loadActivation, status: activationStatus } = useActivationStore();
  const { channel, load: loadModelChannel } = useModelChannelStore();

  useEffect(() => {
    void loadSettings();
    void loadActivation();
    void loadModelChannel();
  }, [loadSettings, loadActivation, loadModelChannel]);

  const rawAvailability = getAvailability();
  const availability =
    rawAvailability.mode === "preset" && !channel.presetEnabled
      ? ({ available: false, reason: "尚未连接模型", mode: "none" } as const)
      : rawAvailability;
  const hasActivePreset =
    channel.presetEnabled &&
    activationStatus === "active" &&
    activation?.status === "active" &&
    activation.expiresAt;
  const isAvailable = availability.available || Boolean(hasActivePreset);
  const label = isAvailable
    ? availability.available
      ? availability.label
      : "预置调用已激活"
    : availability.reason;
  const detail = availability.available
    ? availability.model
    : hasActivePreset
      ? activation?.availableModel
      : apiSettings?.mode === "custom"
        ? "请补全设置"
        : channel.presetEnabled
          ? "需要配置或激活"
          : "需要配置";
  const Icon = isAvailable ? CircleCheck : CircleAlert;

  return (
    <div className="inline-flex items-center gap-2 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.48)] px-3 py-2 font-mono text-xs text-[var(--echo-muted)]">
      <Icon
        aria-hidden="true"
        size={15}
        className={isAvailable ? "text-[var(--echo-paper)]" : "text-[var(--echo-stamp)]"}
      />
      <span>{label}</span>
      {detail && <span className="text-[var(--echo-paper)]">{detail}</span>}
    </div>
  );
}

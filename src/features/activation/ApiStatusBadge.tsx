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
    <div
      className="inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-[var(--animal-radius-pill)] border border-[var(--animal-border)] bg-[var(--animal-primary-bg)] font-mono text-xs text-[var(--animal-text-muted)] sm:size-auto sm:px-3 sm:py-2"
      aria-label={`${label}${detail ? `，${detail}` : ""}`}
      title={`${label}${detail ? `，${detail}` : ""}`}
    >
      <Icon
        aria-hidden="true"
        size={15}
        className={isAvailable ? "text-[var(--animal-success)]" : "text-[var(--animal-error)]"}
      />
      <span className="hidden sm:inline">{label}</span>
      {detail && <span className="hidden text-[var(--animal-text)] sm:inline">{detail}</span>}
    </div>
  );
}

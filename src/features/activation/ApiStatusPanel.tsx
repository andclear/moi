import { CircleCheck, KeyRound, Server } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

import { useActivationStore } from "@/features/activation/activationStore";
import { useModelChannelStore } from "@/features/activation/modelChannelStore";
import { useSettingsStore } from "@/features/settings/settingsStore";
import { Button } from "@/shared/components/ui/button";

export function ApiStatusPanel() {
  const { load: loadSettings, getAvailability } = useSettingsStore();
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
    channel.presetEnabled && activationStatus === "active" && activation?.status === "active";
  const isAvailable = availability.available || hasActivePreset;

  return (
    <aside className="h-full border-l border-[var(--echo-line)] bg-[rgba(18,33,42,0.96)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
            API 状态
          </p>
          <h2 className="mt-2 font-display text-2xl font-black text-[var(--echo-paper)]">
            {isAvailable ? "模型已经接通" : "尚未连接模型"}
          </h2>
        </div>
        <Server aria-hidden="true" size={20} className="text-[var(--echo-muted)]" />
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--echo-muted)]">
        {isAvailable
          ? "后续所有生成都会经由统一 LLM 适配层，并记录模型、耗时和调用结果。"
          : channel.presetEnabled
            ? "你可以配置自己的 OpenAI 兼容接口，或使用激活码开启预置调用模式。"
            : "你可以配置自己的 OpenAI 兼容接口。"}
      </p>
      <div className="mt-5 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.36)] p-4 font-mono text-xs leading-6 text-[var(--echo-muted)]">
        <div className="flex items-center gap-2 text-[var(--echo-paper)]">
          <CircleCheck aria-hidden="true" size={15} />
          <span>{isAvailable ? "可用" : "不可用"}</span>
        </div>
        <p className="mt-2">
          {availability.available
            ? `${availability.label}：${availability.model}`
            : hasActivePreset
              ? `预置调用：${activation?.availableModel ?? "预置模型"}`
              : availability.reason}
        </p>
        {activation?.expiresAt && (
          <p className="mt-1">激活到期：{new Date(activation.expiresAt).toLocaleString()}</p>
        )}
      </div>
      <div className="mt-6 space-y-3">
        <Button asChild variant="secondary" className="w-full justify-start">
          <Link to="/settings">
            <KeyRound aria-hidden="true" size={18} />
            前往设置
          </Link>
        </Button>
      </div>
    </aside>
  );
}

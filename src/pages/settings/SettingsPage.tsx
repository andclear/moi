import { KeyRound, ListChecks, RefreshCw, Save, Server, ToggleLeft, ToggleRight } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { useActivationStore } from "@/features/activation/activationStore";
import { useModelChannelStore } from "@/features/activation/modelChannelStore";
import { defaultApiSettings, useSettingsStore } from "@/features/settings/settingsStore";
import { Button } from "@/shared/components/ui/button";

export function SettingsPage() {
  const { apiSettings, status, errorMessage, load, saveApiSettings } = useSettingsStore();
  const {
    activation,
    status: activationStatus,
    errorMessage: activationError,
    load: loadActivation,
    activate,
  } = useActivationStore();
  const { channel, load: loadModelChannel } = useModelChannelStore();
  const [form, setForm] = useState(defaultApiSettings);
  const [activationCode, setActivationCode] = useState("");
  const [modelOptions, setModelOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [modelListStatus, setModelListStatus] = useState<"idle" | "loading" | "error">("idle");
  const [modelListMessage, setModelListMessage] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadActivation();
    void loadModelChannel();
  }, [load, loadActivation, loadModelChannel]);

  useEffect(() => {
    if (apiSettings) {
      setForm({
        mode: apiSettings.mode,
        apiBaseUrl: apiSettings.apiBaseUrl,
        apiKey: apiSettings.apiKey ?? "",
        model: apiSettings.model,
        temperature: apiSettings.temperature,
        supportsSystemPrompt: apiSettings.supportsSystemPrompt,
      });
    }
  }, [apiSettings]);

  useEffect(() => {
    if (!channel.presetEnabled && form.mode === "preset") {
      setForm((current) => ({ ...current, mode: "none", model: "" }));
    }
  }, [channel.presetEnabled, form.mode]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveApiSettings(form);
  }

  async function handleFetchModels() {
    setModelListStatus("loading");
    setModelListMessage(null);
    try {
      const response = await fetch("/api/custom-llm/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiBaseUrl: form.apiBaseUrl,
          apiKey: form.apiKey,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { models?: Array<{ id: string; label: string }>; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "模型列表获取失败。");
      }

      const models = payload?.models ?? [];
      setModelOptions(models);
      setModelListStatus("idle");
      setModelListMessage(
        models.length ? `已获取 ${models.length} 个模型。` : "接口返回了空模型列表，可继续手动填写。",
      );
    } catch (error) {
      setModelOptions([]);
      setModelListStatus("error");
      setModelListMessage(error instanceof Error ? error.message : "模型列表获取失败。");
    }
  }

  async function handleActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await activate(activationCode);
    await saveApiSettings({
      ...form,
      mode: "preset",
    });
    setActivationCode("");
  }

  return (
    <section className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <article className="border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-4 sm:p-6">
        <Server aria-hidden="true" size={24} className="text-[var(--echo-paper)]" />
        <h1 className="mt-4 font-display text-3xl font-black text-[var(--echo-paper)]">
          API 与模型设置
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--echo-muted)]">
          配置 OpenAI 兼容接口后，所有生成都会通过统一适配层发起，并写入本地调用记录。
        </p>

        <form className="mt-6 grid gap-5" onSubmit={handleSave}>
          <label className="grid gap-2 font-mono text-sm text-[var(--echo-muted)]">
            当前使用渠道
            <select
              value={form.mode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  mode: event.target.value as typeof current.mode,
                }))
              }
              className="h-11 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 text-[var(--echo-paper)] outline-none focus:border-[var(--echo-paper)]"
            >
              <option value="none">暂不连接</option>
              <option value="custom">使用自配 OpenAI 兼容接口</option>
              {channel.presetEnabled && <option value="preset">使用预置调用模式</option>}
            </select>
          </label>

          <div className="grid gap-4 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.24)] p-4">
            <div className="flex items-center gap-2 text-[var(--echo-paper)]">
              <ListChecks aria-hidden="true" size={18} />
              <h2 className="font-display text-xl font-black">自配 OpenAI 兼容接口</h2>
            </div>

          <label className="grid gap-2 font-mono text-sm text-[var(--echo-muted)]">
            API Base URL
            <input
              value={form.apiBaseUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, apiBaseUrl: event.target.value }))
              }
              placeholder="https://api.openai.com/v1"
              className="h-11 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 text-[var(--echo-paper)] outline-none placeholder:text-[var(--animal-text-disabled)] focus:border-[var(--echo-paper)]"
            />
          </label>

          <label className="grid gap-2 font-mono text-sm text-[var(--echo-muted)]">
            API Key
            <input
              value={form.apiKey}
              onChange={(event) =>
                setForm((current) => ({ ...current, apiKey: event.target.value }))
              }
              type="password"
              placeholder="sk-..."
              className="h-11 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 text-[var(--echo-paper)] outline-none placeholder:text-[var(--animal-text-disabled)] focus:border-[var(--echo-paper)]"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-[1fr_160px]">
            <label className="grid gap-2 font-mono text-sm text-[var(--echo-muted)]">
              模型名称
              <input
                value={form.model}
                onChange={(event) =>
                  setForm((current) => ({ ...current, model: event.target.value }))
                }
                placeholder="gpt-4o-mini"
                className="h-11 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 text-[var(--echo-paper)] outline-none placeholder:text-[var(--animal-text-disabled)] focus:border-[var(--echo-paper)]"
              />
            </label>

            <label className="grid gap-2 font-mono text-sm text-[var(--echo-muted)]">
              温度
              <input
                value={form.temperature}
                onChange={(event) =>
                  setForm((current) => ({ ...current, temperature: Number(event.target.value) }))
                }
                type="number"
                min={0}
                max={2}
                step={0.1}
                className="h-11 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 text-[var(--echo-paper)] outline-none focus:border-[var(--echo-paper)]"
              />
            </label>
          </div>

          <div className="grid gap-3">
            <div className="echo-mobile-action-row flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                loading={modelListStatus === "loading"}
                disabled={modelListStatus === "loading" || !form.apiBaseUrl.trim() || !form.apiKey?.trim()}
                onClick={() => void handleFetchModels()}
              >
                {modelListStatus === "loading" ? null : <RefreshCw aria-hidden="true" size={18} />}
                {modelListStatus === "loading" ? "正在获取" : "获取模型列表"}
              </Button>
              {modelListMessage && (
                <span
                  className={[
                    "font-mono text-xs",
                    modelListStatus === "error" ? "text-[var(--echo-stamp)]" : "text-[var(--echo-muted)]",
                  ].join(" ")}
                >
                  {modelListMessage}
                </span>
              )}
            </div>
            {modelOptions.length > 0 && (
              <label className="grid gap-2 font-mono text-sm text-[var(--echo-muted)]">
                从模型列表选择
                <select
                  value={modelOptions.some((option) => option.id === form.model) ? form.model : ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, model: event.target.value }))
                  }
                  className="h-11 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 text-[var(--echo-paper)] outline-none focus:border-[var(--echo-paper)]"
                >
                  <option value="">选择一个模型</option>
                  {modelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                supportsSystemPrompt: !current.supportsSystemPrompt,
              }))
            }
            className="flex items-center justify-between gap-3 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-4 py-3 text-left font-mono text-sm text-[var(--echo-muted)]"
          >
            <span>接口支持 system prompt</span>
            {form.supportsSystemPrompt ? (
              <ToggleRight aria-hidden="true" size={24} className="text-[var(--echo-paper)]" />
            ) : (
              <ToggleLeft aria-hidden="true" size={24} />
            )}
          </button>
          </div>

          {errorMessage && (
            <p className="font-mono text-sm text-[var(--echo-stamp)]">{errorMessage}</p>
          )}
          <div className="echo-mobile-action-row flex items-center gap-3">
            <Button type="submit" loading={status === "saving"} disabled={status === "saving"}>
              {status === "saving" ? null : <Save aria-hidden="true" size={18} />}
              {status === "saving" ? "正在保存" : "保存设置"}
            </Button>
            {status === "saved" && (
              <span className="font-mono text-xs text-[var(--echo-muted)]">设置已保存</span>
            )}
          </div>
        </form>
      </article>

      {channel.presetEnabled && (
        <article className="border-2 border-[var(--echo-line)] bg-[var(--animal-bg-content)] p-4 text-[var(--echo-ink)] sm:p-6">
          <KeyRound aria-hidden="true" size={24} />
          <h2 className="mt-4 font-display text-2xl font-black">预置调用激活</h2>
          <p className="mt-4 font-mono text-sm leading-6">
            激活码只会发送给服务端校验。真实模型密钥保留在服务端环境变量中，不写入浏览器。
          </p>

          <form className="mt-6 grid gap-4" onSubmit={handleActivate}>
            <label className="grid gap-2 font-mono text-sm">
              激活码
              <input
                value={activationCode}
                onChange={(event) => setActivationCode(event.target.value)}
                className="h-11 border-2 border-[var(--echo-ink)] bg-transparent px-3 outline-none focus:border-[var(--echo-stamp)]"
                placeholder="输入收到的激活码"
              />
            </label>
            {activationError && (
              <p className="font-mono text-sm text-[var(--echo-stamp)]">{activationError}</p>
            )}
            <Button
              type="submit"
              disabled={activationStatus === "activating" || !activationCode.trim()}
            >
              <KeyRound aria-hidden="true" size={18} />
              {activationStatus === "activating" ? "正在激活" : "激活预置调用"}
            </Button>
          </form>

          <div className="mt-6 border-2 border-[var(--echo-ink)] p-4 font-mono text-sm leading-7">
            <p>状态：{activation?.status === "active" ? "已激活" : "未激活"}</p>
            {activation?.availableModel && <p>模型：{activation.availableModel}</p>}
            {activation?.expiresAt && (
              <p>到期：{new Date(activation.expiresAt).toLocaleString()}</p>
            )}
            {activation?.usageLimit !== undefined && (
              <p>
                调用：{activation.usageCount}/
                {activation.usageLimit === 0 ? "无限" : activation.usageLimit}
              </p>
            )}
          </div>
        </article>
      )}
    </section>
  );
}

import { KeyRound, Save, Server, ToggleLeft, ToggleRight } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { useActivationStore } from "@/features/activation/activationStore";
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
  const [form, setForm] = useState(defaultApiSettings);
  const [activationCode, setActivationCode] = useState("");

  useEffect(() => {
    void load();
    void loadActivation();
  }, [load, loadActivation]);

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

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveApiSettings(form);
  }

  async function handleActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const record = await activate(activationCode);
    await saveApiSettings({
      ...form,
      mode: "preset",
      model: record.availableModel ?? form.model,
      apiBaseUrl: "",
      apiKey: "",
    });
    setActivationCode("");
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <article className="border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-6">
        <Server aria-hidden="true" size={24} className="text-[var(--echo-paper)]" />
        <h1 className="mt-4 font-display text-3xl font-black text-[var(--echo-paper)]">
          API 与模型设置
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--echo-muted)]">
          配置 OpenAI 兼容接口后，所有生成都会通过统一适配层发起，并写入本地调用记录。
        </p>

        <form className="mt-6 grid gap-5" onSubmit={handleSave}>
          <label className="grid gap-2 font-mono text-sm text-[var(--echo-muted)]">
            调用模式
            <select
              value={form.mode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  mode: event.target.value as typeof current.mode,
                }))
              }
              className="h-11 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.44)] px-3 text-[var(--echo-paper)] outline-none focus:border-[var(--echo-paper)]"
            >
              <option value="none">暂不连接</option>
              <option value="custom">自配 OpenAI 兼容接口</option>
              <option value="preset">预置调用模式</option>
            </select>
          </label>

          <label className="grid gap-2 font-mono text-sm text-[var(--echo-muted)]">
            API Base URL
            <input
              value={form.apiBaseUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, apiBaseUrl: event.target.value }))
              }
              placeholder="https://api.openai.com/v1"
              className="h-11 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.44)] px-3 text-[var(--echo-paper)] outline-none placeholder:text-[rgba(211,197,170,0.38)] focus:border-[var(--echo-paper)]"
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
              className="h-11 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.44)] px-3 text-[var(--echo-paper)] outline-none placeholder:text-[rgba(211,197,170,0.38)] focus:border-[var(--echo-paper)]"
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
                className="h-11 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.44)] px-3 text-[var(--echo-paper)] outline-none placeholder:text-[rgba(211,197,170,0.38)] focus:border-[var(--echo-paper)]"
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
                className="h-11 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.44)] px-3 text-[var(--echo-paper)] outline-none focus:border-[var(--echo-paper)]"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                supportsSystemPrompt: !current.supportsSystemPrompt,
              }))
            }
            className="flex items-center justify-between gap-3 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.34)] px-4 py-3 text-left font-mono text-sm text-[var(--echo-muted)]"
          >
            <span>接口支持 system prompt</span>
            {form.supportsSystemPrompt ? (
              <ToggleRight aria-hidden="true" size={24} className="text-[var(--echo-paper)]" />
            ) : (
              <ToggleLeft aria-hidden="true" size={24} />
            )}
          </button>

          {errorMessage && <p className="font-mono text-sm text-[var(--echo-stamp)]">{errorMessage}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={status === "saving"}>
              <Save aria-hidden="true" size={18} />
              {status === "saving" ? "正在保存" : "保存设置"}
            </Button>
            {status === "saved" && (
              <span className="font-mono text-xs text-[var(--echo-muted)]">设置已保存</span>
            )}
          </div>
        </form>
      </article>

      <article className="border-2 border-[var(--echo-line)] bg-[var(--echo-paper)] p-6 text-[var(--echo-ink)]">
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
          <Button type="submit" disabled={activationStatus === "activating" || !activationCode.trim()}>
            <KeyRound aria-hidden="true" size={18} />
            {activationStatus === "activating" ? "正在激活" : "激活预置调用"}
          </Button>
        </form>

        <div className="mt-6 border-2 border-[var(--echo-ink)] p-4 font-mono text-sm leading-7">
          <p>状态：{activation?.status === "active" ? "已激活" : "未激活"}</p>
          {activation?.availableModel && <p>模型：{activation.availableModel}</p>}
          {activation?.expiresAt && <p>到期：{new Date(activation.expiresAt).toLocaleString()}</p>}
          {activation?.usageLimit && (
            <p>
              调用：{activation.usageCount}/{activation.usageLimit}
            </p>
          )}
        </div>
      </article>
    </section>
  );
}

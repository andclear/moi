import { KeyRound, LockKeyhole, Power, RefreshCw, Server, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";

interface ActivationCodeRow {
  id: string;
  status: string;
  created_at?: string;
  activated_at?: string;
  expires_at?: string;
  duration_hours?: number;
  usage_limit?: number;
  usage_count?: number;
  remaining_seconds?: number | null;
}

interface ModelChannelPayload {
  presetEnabled: boolean;
  model: string;
}

async function readJson<T>(response: Response, fallback: T): Promise<T> {
  return response.json().catch(() => fallback) as Promise<T>;
}

export function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("echo.admin.token") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<ActivationCodeRow[]>([]);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [presetEnabled, setPresetEnabled] = useState(false);
  const [model, setModel] = useState("preset-model");
  const [quantity, setQuantity] = useState(1);
  const [durationHours, setDurationHours] = useState(72);
  const [usageLimit, setUsageLimit] = useState(100);
  const [customCodesText, setCustomCodesText] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = await readJson<{ token?: string; error?: string }>(response, {});
    if (!response.ok || !payload.token) {
      setError(payload.error ?? "登录失败。");
      return;
    }
    localStorage.setItem("echo.admin.token", payload.token);
    setToken(payload.token);
    setPassword("");
  }

  const loadCodes = useCallback(async () => {
    const response = await fetch("/api/admin/activation-codes", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await readJson<{ codes?: ActivationCodeRow[]; error?: string }>(response, {});
    if (!response.ok) {
      setError(payload.error ?? "读取激活码失败。");
      return;
    }
    setCodes(payload.codes ?? []);
  }, [token]);

  const loadModelChannel = useCallback(async () => {
    const response = await fetch("/api/admin/model-channel", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await readJson<(ModelChannelPayload & { error?: string }) | { error?: string }>(
      response,
      {},
    );
    if (!response.ok || !("presetEnabled" in payload)) {
      setError(payload.error ?? "读取预置渠道失败。");
      return;
    }
    setPresetEnabled(payload.presetEnabled);
    setModel(payload.model);
  }, [token]);

  useEffect(() => {
    if (token) {
      void loadModelChannel();
      void loadCodes();
    }
  }, [token, loadCodes, loadModelChannel]);

  async function createCode() {
    const response = await fetch("/api/admin/activation-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        quantity,
        durationHours,
        usageLimit,
        customCodes: customCodesText
          .split("\n")
          .map((code) => code.trim())
          .filter(Boolean),
      }),
    });
    const payload = await readJson<{
      codes?: Array<{ code: string }>;
      error?: string;
    }>(response, {});
    if (!response.ok) {
      setError(payload.error ?? "生成激活码失败。");
      return;
    }
    setNewCodes(payload.codes?.map((item) => item.code) ?? []);
    setCustomCodesText("");
    await loadCodes();
  }

  async function deleteCode(id: string) {
    const response = await fetch("/api/admin/activation-codes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      const payload = await readJson<{ error?: string }>(response, {});
      setError(payload.error ?? "删除激活码失败。");
      return;
    }
    await loadCodes();
  }

  async function saveModelChannel() {
    const response = await fetch("/api/admin/model-channel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ presetEnabled, model }),
    });
    if (!response.ok) {
      const payload = await readJson<{ error?: string }>(response, {});
      setError(payload.error ?? "保存预置渠道失败。");
      return;
    }
    await loadModelChannel();
  }

  function formatCodeStatus(code: ActivationCodeRow) {
    if (code.status === "unused") {
      return "未使用";
    }
    if (code.status === "used") {
      const hours = Math.max(0, Math.floor((code.remaining_seconds ?? 0) / 3600));
      const minutes = Math.max(0, Math.floor(((code.remaining_seconds ?? 0) % 3600) / 60));
      return `已使用，剩余 ${hours} 小时 ${minutes} 分钟`;
    }
    if (code.status === "expired") {
      return "已过期";
    }
    if (code.status === "disabled") {
      return "已禁用";
    }
    return code.status;
  }

  if (!token) {
    return (
      <section className="mx-auto max-w-lg border-2 border-[var(--echo-line)] bg-[var(--echo-paper)] p-8 text-[var(--echo-ink)] shadow-[8px_8px_0_var(--echo-shadow)]">
        <LockKeyhole aria-hidden="true" size={28} />
        <h1 className="mt-5 font-display text-3xl font-black">后台登录</h1>
        <p className="mt-4 font-mono text-sm leading-6">
          后台接口会校验管理员口令，并把生成激活码、模型渠道调整等操作写入审计日志。
        </p>
        <form className="mt-6 space-y-5" onSubmit={handleLogin}>
          <label
            className="block text-sm font-black uppercase tracking-[0.12em]"
            htmlFor="admin-password"
          >
            管理员口令
          </label>
          <input
            id="admin-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            className="w-full border-0 border-b-2 border-[var(--echo-ink)] bg-transparent py-2 font-mono outline-none"
            placeholder="输入后台口令"
          />
          {error && <p className="font-mono text-sm text-[var(--echo-stamp)]">{error}</p>}
          <Button type="submit">
            <KeyRound aria-hidden="true" size={18} />
            进入后台
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <article className="border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-6">
        <Server aria-hidden="true" size={24} className="text-[var(--echo-paper)]" />
        <h1 className="mt-4 font-display text-3xl font-black text-[var(--echo-paper)]">
          预置模型渠道
        </h1>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 font-mono text-sm text-[var(--echo-muted)]">
            模型名称
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="h-11 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.44)] px-3 text-[var(--echo-paper)] outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setPresetEnabled((current) => !current)}
            className="flex items-center justify-between border border-[var(--echo-line)] px-4 py-3 font-mono text-sm text-[var(--echo-muted)]"
          >
            <span>预置渠道</span>
            <span>{presetEnabled ? "开启" : "关闭"}</span>
          </button>
          <Button type="button" onClick={saveModelChannel}>
            <Power aria-hidden="true" size={18} />
            保存渠道
          </Button>
        </div>
      </article>

      <article className="border-2 border-[var(--echo-line)] bg-[var(--echo-paper)] p-6 text-[var(--echo-ink)]">
        <KeyRound aria-hidden="true" size={24} />
        <h2 className="mt-4 font-display text-2xl font-black">激活码</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 font-mono text-sm">
            生成数量
            <input
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              min={1}
              max={200}
              type="number"
              className="h-11 border-2 border-[var(--echo-ink)] bg-transparent px-3 outline-none"
            />
          </label>
          <label className="grid gap-2 font-mono text-sm">
            可用时长（小时）
            <input
              value={durationHours}
              onChange={(event) => setDurationHours(Number(event.target.value))}
              min={1}
              max={8760}
              type="number"
              className="h-11 border-2 border-[var(--echo-ink)] bg-transparent px-3 outline-none"
            />
          </label>
          <label className="grid gap-2 font-mono text-sm">
            调用上限
            <input
              value={usageLimit}
              onChange={(event) => setUsageLimit(Number(event.target.value))}
              min={1}
              max={100000}
              type="number"
              className="h-11 border-2 border-[var(--echo-ink)] bg-transparent px-3 outline-none"
            />
          </label>
        </div>
        <label className="mt-4 grid gap-2 font-mono text-sm">
          自定义激活码（可选，每行一个）
          <textarea
            value={customCodesText}
            onChange={(event) => setCustomCodesText(event.target.value)}
            rows={3}
            className="resize-y border-2 border-[var(--echo-ink)] bg-transparent px-3 py-2 outline-none"
            placeholder="例如：123&#10;LPB-abc"
          />
        </label>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" onClick={createCode}>
            <KeyRound aria-hidden="true" size={18} />
            生成激活码
          </Button>
          <Button type="button" variant="secondary" onClick={loadCodes}>
            <RefreshCw aria-hidden="true" size={18} />
            刷新列表
          </Button>
        </div>
        {newCodes.length > 0 && (
          <div className="mt-4 border-2 border-[var(--echo-ink)] p-3 font-mono text-sm">
            <p className="font-black">新激活码（只显示这一次）：</p>
            <div className="mt-2 grid gap-1">
              {newCodes.map((code) => (
                <code key={code}>{code}</code>
              ))}
            </div>
          </div>
        )}
        {error && <p className="mt-4 font-mono text-sm text-[var(--echo-stamp)]">{error}</p>}
        <div className="mt-5 grid gap-2 font-mono text-xs">
          {codes.map((code) => (
            <div key={code.id} className="border border-[var(--echo-ink)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p>{code.id}</p>
                  <p>{formatCodeStatus(code)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteCode(code.id)}
                  className="inline-flex h-9 w-9 items-center justify-center border border-[var(--echo-ink)]"
                  aria-label="删除激活码"
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
              <p>
                时长：{code.duration_hours ?? 72} 小时 · 调用：{code.usage_count ?? 0}/
                {code.usage_limit ?? 0}
              </p>
              {code.activated_at && <p>激活：{new Date(code.activated_at).toLocaleString()}</p>}
              {code.expires_at && <p>到期：{new Date(code.expires_at).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

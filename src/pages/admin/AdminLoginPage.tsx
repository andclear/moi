import { KeyRound, LockKeyhole, Power, RefreshCw, Server } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/shared/components/ui/button";

interface ActivationCodeRow {
  id: string;
  status: string;
  created_at?: string;
  expires_at?: string;
  usage_limit?: number;
  usage_count?: number;
}

export function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("echo.admin.token") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<ActivationCodeRow[]>([]);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [presetEnabled, setPresetEnabled] = useState(true);
  const [model, setModel] = useState("preset-model");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = (await response.json()) as { token?: string; error?: string };
    if (!response.ok || !payload.token) {
      setError(payload.error ?? "登录失败。");
      return;
    }
    localStorage.setItem("echo.admin.token", payload.token);
    setToken(payload.token);
    setPassword("");
  }

  async function loadCodes() {
    const response = await fetch("/api/admin/activation-codes", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json()) as { codes?: ActivationCodeRow[]; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "读取激活码失败。");
      return;
    }
    setCodes(payload.codes ?? []);
  }

  async function createCode() {
    const response = await fetch("/api/admin/activation-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ usageLimit: 100 }),
    });
    const payload = (await response.json()) as { code?: string; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "生成激活码失败。");
      return;
    }
    setNewCode(payload.code ?? null);
    await loadCodes();
  }

  async function saveModelChannel() {
    const response = await fetch("/api/admin/model-channel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ presetEnabled, model }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "保存预置渠道失败。");
    }
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
        {newCode && (
          <p className="mt-4 border-2 border-[var(--echo-ink)] p-3 font-mono text-sm">
            新激活码：{newCode}
          </p>
        )}
        {error && <p className="mt-4 font-mono text-sm text-[var(--echo-stamp)]">{error}</p>}
        <div className="mt-5 grid gap-2 font-mono text-xs">
          {codes.map((code) => (
            <div key={code.id} className="border border-[var(--echo-ink)] p-3">
              <p>{code.id}</p>
              <p>
                {code.status} · {code.usage_count ?? 0}/{code.usage_limit ?? 0}
              </p>
              {code.expires_at && <p>到期：{new Date(code.expires_at).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

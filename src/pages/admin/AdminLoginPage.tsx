import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  ListFilter,
  LockKeyhole,
  Power,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";

interface ActivationCodeRow {
  id: string;
  code: string;
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

type ActivationCodeFilter = "all" | "unused" | "used";

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
  const [model, setModel] = useState("预置调用");
  const [quantity, setQuantity] = useState(1);
  const [durationHours, setDurationHours] = useState(72);
  const [usageLimit, setUsageLimit] = useState(100);
  const [customCodesText, setCustomCodesText] = useState("");
  const [codeFilter, setCodeFilter] = useState<ActivationCodeFilter>("all");
  const [page, setPage] = useState(1);
  const [totalCodes, setTotalCodes] = useState(0);
  const pageSize = 30;

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

  const loadCodes = useCallback(async (nextPage: number, nextFilter: ActivationCodeFilter) => {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(pageSize),
      status: nextFilter,
    });
    const response = await fetch(`/api/admin/activation-codes?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await readJson<{
      codes?: ActivationCodeRow[];
      total?: number;
      page?: number;
      error?: string;
    }>(response, {});
    if (!response.ok) {
      setError(payload.error ?? "读取激活码失败。");
      return [];
    }
    setCodes(payload.codes ?? []);
    setTotalCodes(payload.total ?? 0);
    setPage(payload.page ?? nextPage);
    return payload.codes ?? [];
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
      void loadCodes(1, codeFilter);
    }
  }, [token, codeFilter, loadCodes, loadModelChannel]);

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
    await loadCodes(1, codeFilter);
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
    const rows = await loadCodes(page, codeFilter);
    if (rows.length === 0 && page > 1) {
      await loadCodes(page - 1, codeFilter);
    }
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
      if (code.duration_hours === 0) {
        return "已使用，无限时长";
      }
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

  function formatDuration(hours: number | undefined) {
    return hours === 0 ? "无限时长" : `${hours ?? 72} 小时`;
  }

  function formatUsageLimit(limit: number | undefined, count: number | undefined) {
    return `${count ?? 0}/${limit === 0 ? "无限" : (limit ?? 0)}`;
  }

  async function switchFilter(nextFilter: ActivationCodeFilter) {
    setCodeFilter(nextFilter);
    await loadCodes(1, nextFilter);
  }

  async function turnPage(nextPage: number) {
    await loadCodes(nextPage, codeFilter);
  }

  if (!token) {
    return (
      <section className="mx-auto max-w-lg border-2 border-[var(--echo-line)] bg-[var(--animal-bg-content)] p-8 text-[var(--echo-ink)] shadow-[0_4px_10px_rgba(107,92,67,0.28)]">
        <LockKeyhole aria-hidden="true" size={28} />
        <h1 className="mt-5 font-display text-3xl font-black">后台登录</h1>
        <p className="mt-4 font-mono text-sm leading-6">
          后台接口会校验管理员口令，并把生成激活码、模型渠道调整等操作写入审计日志。
        </p>
        <form className="mt-6 space-y-5" onSubmit={handleLogin}>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value="admin"
            readOnly
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
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
            autoComplete="current-password"
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
            预设名称
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="h-11 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 text-[var(--echo-paper)] outline-none"
            />
            <span className="text-xs text-[var(--echo-muted)]">
              仅用于前端展示，真实模型名称读取服务端 PRESET_MODEL。
            </span>
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

      <article className="border-2 border-[var(--echo-line)] bg-[var(--animal-bg-content)] p-6 text-[var(--echo-ink)]">
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
              min={0}
              max={8760}
              type="number"
              className="h-11 border-2 border-[var(--echo-ink)] bg-transparent px-3 outline-none"
            />
            <span className="text-xs text-[var(--echo-muted-ink)]">填 0 代表无限时长</span>
          </label>
          <label className="grid gap-2 font-mono text-sm">
            调用上限
            <input
              value={usageLimit}
              onChange={(event) => setUsageLimit(Number(event.target.value))}
              min={0}
              max={100000}
              type="number"
              className="h-11 border-2 border-[var(--echo-ink)] bg-transparent px-3 outline-none"
            />
            <span className="text-xs text-[var(--echo-muted-ink)]">按模型请求次数计数，填 0 不限</span>
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
          <Button type="button" variant="secondary" onClick={() => void loadCodes(page, codeFilter)}>
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
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y-2 border-[var(--echo-ink)] py-3">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <ListFilter aria-hidden="true" size={16} />
            {(
              [
                ["all", "全部"],
                ["unused", "未使用"],
                ["used", "已使用"],
              ] satisfies Array<[ActivationCodeFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => void switchFilter(value)}
                className={`border border-[var(--echo-ink)] px-3 py-2 ${
                  codeFilter === value ? "bg-[var(--echo-ink)] text-[var(--echo-paper)]" : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="font-mono text-xs">
            共 {totalCodes} 个 · 第 {page}/{Math.max(1, Math.ceil(totalCodes / pageSize))} 页
          </p>
        </div>
        <div className="mt-5 grid gap-2 font-mono text-xs">
          {codes.map((code) => (
            <div key={code.id} className="border border-[var(--echo-ink)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="break-all text-sm font-black">{code.code}</p>
                  <p>{formatCodeStatus(code)}</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  danger
                  onClick={() => void deleteCode(code.id)}
                  aria-label="删除激活码"
                >
                  <Trash2 aria-hidden="true" size={16} />
                </Button>
              </div>
              <p>
                时长：{formatDuration(code.duration_hours)} · 调用：
                {formatUsageLimit(code.usage_limit, code.usage_count)}
              </p>
              {code.activated_at && <p>激活：{new Date(code.activated_at).toLocaleString()}</p>}
              {code.expires_at && <p>到期：{new Date(code.expires_at).toLocaleString()}</p>}
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => void turnPage(page - 1)}
            className="inline-flex h-9 items-center gap-2 border border-[var(--echo-ink)] px-3 disabled:opacity-40"
          >
            <ChevronLeft aria-hidden="true" size={16} />
            上一页
          </button>
          <button
            type="button"
            disabled={page >= Math.max(1, Math.ceil(totalCodes / pageSize))}
            onClick={() => void turnPage(page + 1)}
            className="inline-flex h-9 items-center gap-2 border border-[var(--echo-ink)] px-3 disabled:opacity-40"
          >
            下一页
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      </article>
    </section>
  );
}

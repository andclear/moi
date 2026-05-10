import { KeyRound, Server } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/shared/components/ui/button";

export function ApiStatusPanel() {
  return (
    <aside className="h-full border-l border-[var(--echo-line)] bg-[rgba(18,33,42,0.96)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
            API 状态
          </p>
          <h2 className="mt-2 font-display text-2xl font-black text-[var(--echo-paper)]">
            尚未连接模型
          </h2>
        </div>
        <Server aria-hidden="true" size={20} className="text-[var(--echo-muted)]" />
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--echo-muted)]">
        阶段 4 会接入自配 OpenAI 兼容接口与预置调用激活。当前只保留全局提示入口。
      </p>
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

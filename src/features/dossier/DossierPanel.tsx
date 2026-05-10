import { LockKeyhole, PenLine } from "lucide-react";

export function DossierPanel() {
  return (
    <aside className="h-full border-l border-[var(--echo-line)] bg-[rgba(18,33,42,0.96)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
            TA 的回音
          </p>
          <h2 className="mt-2 font-display text-2xl font-black text-[var(--echo-paper)]">
            回音墙
          </h2>
        </div>
        <LockKeyhole aria-hidden="true" size={20} className="text-[var(--echo-muted)]" />
      </div>
      <p className="mt-4 font-mono text-sm leading-6 text-[var(--echo-muted)]">
        阶段 3 会在这里接入可编辑、可锁定、可标记事实来源的 Markdown 档案。
      </p>
      <div className="mt-6 border border-dashed border-[var(--echo-line)] bg-[rgba(2,16,24,0.36)] p-4 font-mono text-sm leading-7 text-[var(--echo-muted)]">
        <div className="flex items-center gap-2 text-[var(--echo-paper)]">
          <PenLine aria-hidden="true" size={16} />
          <span>等待第一条线索</span>
        </div>
        <div className="mt-4">
          ## 核心人格
          <br />
          暂无记录
          <br />
          <br />
          ## 世界观
          <br />
          暂无记录
        </div>
      </div>
    </aside>
  );
}

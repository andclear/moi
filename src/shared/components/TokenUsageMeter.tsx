import { Gauge } from "lucide-react";

import type { GenerationTask } from "@/db/types";

interface TokenUsageMeterProps {
  task?: GenerationTask | null;
}

export function TokenUsageMeter({ task }: TokenUsageMeterProps) {
  if (!task) {
    return null;
  }

  const totalTokens = task.usage?.totalTokens ?? 0;
  const duration = task.usage?.durationMs ? `${(task.usage.durationMs / 1000).toFixed(1)} 秒` : "未记录";

  return (
    <div className="inline-flex items-center gap-2 border border-[var(--echo-line)] bg-[rgba(2,16,24,0.42)] px-3 py-2 font-mono text-xs text-[var(--echo-muted)]">
      <Gauge aria-hidden="true" size={15} />
      <span>Token：{totalTokens || "未返回"}</span>
      <span>耗时：{duration}</span>
    </div>
  );
}

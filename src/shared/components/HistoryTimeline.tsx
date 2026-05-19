import { Clock3 } from "lucide-react";

import type { HistorySnapshot } from "@/db/types";
import { Button } from "@/shared/components/ui/button";

interface HistoryTimelineProps {
  histories: HistorySnapshot[];
  onRestore?: (historyId: string) => void;
}

export function HistoryTimeline({ histories, onRestore }: HistoryTimelineProps) {
  if (histories.length === 0) {
    return (
      <p className="font-mono text-sm leading-6 text-[var(--echo-muted)]">
        暂时还没有留下可回溯的节点。
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {histories.map((history) => (
        <li
          key={history.id}
          className="rounded-[var(--animal-radius-sm)] border border-[var(--animal-border)] bg-[rgba(255,255,255,0.42)] p-3 text-[var(--animal-text-muted)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-[var(--echo-paper)]">
                <Clock3 aria-hidden="true" size={15} />
                {history.title}
              </p>
              <p className="mt-1 font-mono text-xs">
                {new Date(history.createdAt).toLocaleString()} · {history.step}
              </p>
            </div>
            {onRestore && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onRestore(history.id)}>
                回到这里
              </Button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

import { Check, Circle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { FlowStep } from "@/features/flow/flowTypes";
import type { FlowStepId } from "@/features/flow/flowStore";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { cn } from "@/shared/lib/utils";

interface StepProgressProps {
  steps: FlowStep[];
  currentStepId: FlowStepId;
  completedStepIds?: FlowStepId[];
}

export function StepProgress({ steps, currentStepId, completedStepIds = [] }: StepProgressProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
  const [pendingTarget, setPendingTarget] = useState<FlowStep | null>(null);

  return (
    <>
      <ol className="grid gap-3 lg:grid-cols-1" aria-label="创作流程进度">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isDone = completedStepIds.includes(step.id) || index < currentIndex;
          const isCurrent = step.id === currentStepId;
          const content = (
            <>
              <div className="flex items-center justify-between gap-2">
                <Icon aria-hidden="true" size={18} />
                {isDone ? (
                  <Check aria-hidden="true" size={16} />
                ) : (
                  <Circle aria-hidden="true" size={14} />
                )}
              </div>
              <p className="mt-3 text-sm font-black">{step.label}</p>
              <p className="mt-1 text-xs leading-5">{step.description}</p>
            </>
          );

          return (
            <li key={step.id}>
              <Link
                to={`/workspace/current/${step.id}`}
                onClick={(event) => {
                  if (!isDone && !isCurrent) {
                    event.preventDefault();
                    return;
                  }
                  if (isDone && !isCurrent) {
                    event.preventDefault();
                    setPendingTarget(step);
                  }
                }}
                aria-disabled={!isDone && !isCurrent}
                className={cn(
                  "block min-h-full border p-3 transition-colors",
                  isDone || isCurrent ? "cursor-pointer" : "cursor-default",
                  isCurrent
                    ? "border-[var(--echo-paper)] bg-[var(--echo-paper)] text-[var(--echo-ink)] shadow-[4px_4px_0_var(--echo-shadow)]"
                    : "border-[var(--echo-line)] bg-[rgba(18,33,42,0.88)] text-[var(--echo-muted)]",
                  isDone &&
                    !isCurrent &&
                    "hover:border-[var(--echo-paper)] hover:text-[var(--echo-text)]",
                )}
              >
                {content}
              </Link>
            </li>
          );
        })}
      </ol>
      <ConfirmDialog
        open={Boolean(pendingTarget)}
        title="回到旧节点"
        description={`确定回到「${pendingTarget?.label ?? ""}」吗？当前档案会保留，但后续生成可能需要重新确认。`}
        confirmLabel="回到这里"
        onCancel={() => setPendingTarget(null)}
        onConfirm={() => {
          if (pendingTarget) {
            window.location.href = `/workspace/current/${pendingTarget.id}`;
          }
        }}
      />
    </>
  );
}

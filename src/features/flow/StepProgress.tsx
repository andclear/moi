import { ArrowRight, Check, Circle } from "lucide-react";
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
  compact?: boolean;
}

export function StepProgress({
  steps,
  currentStepId,
  completedStepIds = [],
  compact = false,
}: StepProgressProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
  const [pendingTarget, setPendingTarget] = useState<FlowStep | null>(null);

  if (compact) {
    return (
      <>
        <ol className="grid grid-cols-2 gap-2" aria-label="创作流程进度">
          {steps.map((step, index) => {
            const isDone = completedStepIds.includes(step.id) || index < currentIndex;
            const isCurrent = step.id === currentStepId;
            return (
              <Fragment key={step.id}>
                <li>
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
                      "flex w-full items-center justify-center rounded-[var(--animal-radius-pill)] border-2 px-4 py-2 text-center text-xs font-black transition-all duration-200",
                      isDone || isCurrent ? "cursor-pointer" : "cursor-default",
                      isCurrent
                        ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)] shadow-[0_3px_0_0_var(--animal-shadow-input)]"
                        : "border-[var(--animal-border)] bg-[rgba(255,255,255,0.38)] text-[var(--animal-text-muted)]",
                      isDone &&
                        !isCurrent &&
                        "hover:-translate-y-0.5 hover:border-[var(--animal-primary)] hover:text-[var(--animal-text)]",
                    )}
                  >
                    <span className="block truncate whitespace-nowrap">{step.label}</span>
                  </Link>
                </li>
                {index < steps.length - 1 ? (
                  <li className="col-span-2 flex justify-center py-0.5 text-[var(--animal-text-disabled)]">
                    <ArrowRight aria-hidden="true" size={14} />
                  </li>
                ) : null}
              </Fragment>
            );
          })}
        </ol>
      </>
    );
  }

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
                  "block min-h-full rounded-[var(--animal-radius)] border-2 p-3 transition-all duration-200",
                  isDone || isCurrent ? "cursor-pointer" : "cursor-default",
                  isCurrent
                    ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)] shadow-[0_4px_0_0_var(--animal-shadow-input)]"
                    : "border-[var(--animal-border)] bg-[var(--animal-bg-content)] text-[var(--animal-text-muted)]",
                  isDone &&
                    !isCurrent &&
                    "hover:-translate-y-0.5 hover:border-[var(--animal-primary)] hover:text-[var(--animal-text)]",
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
        description={`确定回到「${pendingTarget?.label ?? ""}」吗？当前记录会保留，但后续生成可能需要重新确认。`}
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

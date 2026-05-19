import { Button as AnimalButton } from "animal-island-ui";
import { Play, RotateCcw, Square } from "lucide-react";

import { Button, type ButtonProps } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

interface GenerationButtonProps extends Omit<ButtonProps, "onClick"> {
  status?: "idle" | "pending" | "running" | "succeeded" | "failed" | "cancelled";
  errorMessage?: string;
  idleLabel: string;
  runningLabel?: string;
  retryLabel?: string;
  onGenerate: () => void;
  onCancel?: () => void;
  useAnimalLoadingButton?: boolean;
}

export function GenerationButton({
  status = "idle",
  errorMessage,
  idleLabel,
  runningLabel = "正在寻找",
  retryLabel = "重新生成",
  onGenerate,
  onCancel,
  useAnimalLoadingButton = false,
  className,
  disabled,
  ...props
}: GenerationButtonProps) {
  const isRunning = status === "running" || status === "pending";
  const isFailed = status === "failed";

  if (isRunning && useAnimalLoadingButton) {
    return (
      <div className="space-y-2">
        <AnimalButton
          htmlType="button"
          type="primary"
          loading={true}
          disabled={disabled || (isRunning && !onCancel)}
          className={cn("echo-cancellable-loading-button min-w-40", className)}
          onClick={onCancel}
        >
          {onCancel ? "取消生成" : runningLabel}
        </AnimalButton>
        {errorMessage && (
          <p className="max-w-xl font-mono text-xs leading-5 text-[var(--echo-stamp)]">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={isRunning ? onCancel : onGenerate}
        disabled={disabled || (isRunning && !onCancel)}
        loading={isRunning ? true : false}
        className={cn("min-w-40", className)}
        {...props}
      >
        {isRunning ? null : isFailed ? (
          <RotateCcw aria-hidden="true" size={18} />
        ) : (
          <Play aria-hidden="true" size={18} />
        )}
        {isRunning ? (onCancel ? "取消生成" : runningLabel) : isFailed ? retryLabel : idleLabel}
        {isRunning && onCancel ? <Square aria-hidden="true" size={14} /> : null}
      </Button>
      {errorMessage && (
        <p className="max-w-xl font-mono text-xs leading-5 text-[var(--echo-stamp)]">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

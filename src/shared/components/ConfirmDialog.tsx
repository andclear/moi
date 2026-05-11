import { AlertTriangle } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,16,24,0.68)] p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md border-2 border-[var(--echo-line)] bg-[var(--echo-paper)] p-6 text-[var(--echo-ink)] shadow-[10px_10px_0_var(--echo-shadow)]"
      >
        <AlertTriangle aria-hidden="true" size={22} className="text-[var(--echo-stamp)]" />
        <h2 className="mt-4 font-display text-2xl font-black">{title}</h2>
        <p className="mt-3 font-mono text-sm leading-6">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}

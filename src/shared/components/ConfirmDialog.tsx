import { Modal } from "animal-island-ui";
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
  return (
    <Modal
      open={open}
      title={title}
      width={480}
      typewriter={false}
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-[var(--animal-text-body)]">
        <AlertTriangle aria-hidden="true" size={22} className="text-[var(--animal-error)]" />
        <p className="mt-3 font-mono text-sm leading-6 text-[var(--animal-text-muted)]">{description}</p>
      </div>
    </Modal>
  );
}

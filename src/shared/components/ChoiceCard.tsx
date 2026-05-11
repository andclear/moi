import { Check, Circle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface ChoiceCardProps {
  title: string;
  content: string;
  detail?: string;
  selected?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  onSelect: () => void;
}

export function ChoiceCard({
  title,
  content,
  detail,
  selected = false,
  disabled = false,
  children,
  onSelect,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "min-h-full w-full cursor-pointer border-2 p-4 text-left transition-colors disabled:cursor-default disabled:opacity-70",
        selected
          ? "border-[var(--echo-paper)] bg-[var(--echo-paper)] text-[var(--echo-ink)] shadow-[5px_5px_0_var(--echo-shadow)]"
          : "border-[var(--echo-line)] bg-[rgba(18,33,42,0.86)] text-[var(--echo-text)] hover:border-[var(--echo-paper)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-black tracking-normal">{title}</h3>
        {selected ? <Check aria-hidden="true" size={18} /> : <Circle aria-hidden="true" size={16} />}
      </div>
      <p className="mt-3 font-mono text-sm leading-6">{content}</p>
      {detail && <p className="mt-3 text-xs leading-5 opacity-75">{detail}</p>}
      {children}
    </button>
  );
}

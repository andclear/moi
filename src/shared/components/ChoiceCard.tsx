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
        "min-h-full w-full cursor-pointer rounded-[var(--animal-radius)] border-2 p-4 text-left transition-all duration-200 disabled:cursor-default disabled:opacity-70",
        selected
          ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)] shadow-[0_4px_0_0_var(--animal-shadow-input)]"
          : "border-[var(--animal-border)] bg-[var(--animal-bg-content)] text-[var(--animal-text-body)] shadow-[0_3px_0_0_var(--animal-shadow-input)] hover:-translate-y-1 hover:border-[var(--animal-primary)]",
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

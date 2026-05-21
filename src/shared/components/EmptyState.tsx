import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon: Icon = Search, action }: EmptyStateProps) {
  return (
    <section className="rounded-[var(--animal-radius-lg)] border-2 border-dashed border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-5 text-center shadow-[0_3px_10px_rgba(61,52,40,0.1)] sm:p-8">
      <Icon aria-hidden="true" size={28} className="mx-auto text-[var(--animal-primary)]" />
      <h2 className="mt-4 font-display text-2xl font-black text-[var(--animal-text)]">{title}</h2>
      <p className="mx-auto mt-3 max-w-md font-mono text-sm leading-6 text-[var(--animal-text-muted)]">
        {description}
      </p>
      {action && <div className="mt-6 flex justify-center max-sm:[&>*]:w-full">{action}</div>}
    </section>
  );
}

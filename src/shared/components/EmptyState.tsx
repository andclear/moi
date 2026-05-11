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
    <section className="border-2 border-dashed border-[var(--echo-line)] bg-[rgba(18,33,42,0.5)] p-8 text-center">
      <Icon aria-hidden="true" size={28} className="mx-auto text-[var(--echo-muted)]" />
      <h2 className="mt-4 font-display text-2xl font-black text-[var(--echo-paper)]">{title}</h2>
      <p className="mx-auto mt-3 max-w-md font-mono text-sm leading-6 text-[var(--echo-muted)]">
        {description}
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </section>
  );
}

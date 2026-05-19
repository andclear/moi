import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

interface GeneratedResultCardProps {
  title: string;
  eyebrow?: string;
  content: string;
  footer?: ReactNode;
}

export function GeneratedResultCard({ title, eyebrow, content, footer }: GeneratedResultCardProps) {
  return (
    <article className="rounded-[var(--animal-radius)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-5 text-[var(--animal-text-body)] shadow-[0_4px_10px_rgba(107,92,67,0.3)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--animal-primary)]">
              {eyebrow}
            </p>
          )}
          <h3 className="mt-2 font-display text-2xl font-black tracking-normal">{title}</h3>
        </div>
        <Sparkles aria-hidden="true" size={18} className="text-[var(--animal-primary)]" />
      </div>
      <p className="mt-4 whitespace-pre-wrap font-mono text-sm leading-7">{content}</p>
      {footer && <div className="mt-5">{footer}</div>}
    </article>
  );
}

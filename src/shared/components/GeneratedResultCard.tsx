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
    <article className="border-2 border-[var(--echo-line)] bg-[rgba(244,231,203,0.96)] p-5 text-[var(--echo-ink)] shadow-[6px_6px_0_var(--echo-shadow)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-stamp)]">
              {eyebrow}
            </p>
          )}
          <h3 className="mt-2 font-display text-2xl font-black tracking-normal">{title}</h3>
        </div>
        <Sparkles aria-hidden="true" size={18} className="text-[var(--echo-stamp)]" />
      </div>
      <p className="mt-4 whitespace-pre-wrap font-mono text-sm leading-7">{content}</p>
      {footer && <div className="mt-5">{footer}</div>}
    </article>
  );
}

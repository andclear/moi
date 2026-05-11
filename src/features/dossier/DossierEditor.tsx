import { Eye, FilePenLine, LockKeyhole, Sparkles, UnlockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";

import type { DossierBlockMeta } from "@/db/types";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { parseDossierSections } from "@/features/dossier/dossierSections";

interface DossierEditorProps {
  markdown: string;
  blocks: DossierBlockMeta[];
  onChange: (markdown: string) => void;
  onToggleLock: (section: string) => void;
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-5 font-mono text-sm leading-7 text-[var(--echo-muted)]">
      {markdown.split(/\n(?=##\s+)/).map((section) => {
        const [headingLine = "", ...bodyLines] = section.split(/\r?\n/);
        const heading = headingLine.replace(/^##\s+/, "").trim();
        const body = bodyLines.join("\n").trim();

        return (
          <section key={heading || section} className="border-b border-[var(--echo-line)] pb-4">
            {heading && (
              <h3 className="font-display text-lg font-black text-[var(--echo-paper)]">
                {heading}
              </h3>
            )}
            <div className="mt-3 space-y-2">
              {(body || "尚未听见").split(/\n{2,}/).map((paragraph, index) => (
                <p key={`${heading}-${index}`}>{renderInlineMarkdown(paragraph)}</p>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function DossierEditor({
  markdown,
  blocks,
  onChange,
  onToggleLock,
}: DossierEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const sections = useMemo(() => parseDossierSections(markdown), [markdown]);
  const metaBySection = useMemo(
    () => new Map(blocks.map((block) => [block.section, block])),
    [blocks],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[var(--echo-line)] px-4 py-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "edit" ? "primary" : "ghost"}
            onClick={() => setMode("edit")}
          >
            <FilePenLine aria-hidden="true" size={16} />
            编辑
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "preview" ? "primary" : "ghost"}
            onClick={() => setMode("preview")}
          >
            <Eye aria-hidden="true" size={16} />
            预览
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-[1_1_auto] overflow-auto p-4">
        {mode === "edit" ? (
          <textarea
            value={markdown}
            onChange={(event) => onChange(event.target.value)}
            className="h-full min-h-[42rem] w-full resize-y border border-[var(--echo-line)] bg-[rgba(2,16,24,0.46)] p-4 font-mono text-sm leading-7 text-[var(--echo-paper)] outline-none placeholder:text-[var(--echo-muted)] focus:border-[var(--echo-paper)]"
            spellCheck={false}
            aria-label="编辑 TA 的回音 Markdown"
          />
        ) : (
          <MarkdownPreview markdown={markdown} />
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--echo-line)] bg-[rgba(2,16,24,0.18)] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
            段落事实状态
          </p>
          <span className="font-mono text-[11px] text-[var(--echo-muted)]">
            点击切换锁定
          </span>
        </div>
        <div className="mt-2 grid max-h-40 gap-1.5 overflow-auto pr-1">
          {sections.map((section) => {
            const meta = metaBySection.get(section.section);
            const locked = Boolean(meta?.locked);
            const source = meta?.source ?? "ai_inferred";

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onToggleLock(section.section)}
                className={cn(
                  "flex items-center justify-between gap-2 border border-[var(--echo-line)] px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors",
                  locked
                    ? "bg-[rgba(211,197,170,0.14)] text-[var(--echo-paper)]"
                    : "bg-[rgba(2,16,24,0.28)] text-[var(--echo-muted)] hover:text-[var(--echo-paper)]",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {locked ? (
                    <LockKeyhole aria-hidden="true" size={13} />
                  ) : (
                    <UnlockKeyhole aria-hidden="true" size={13} />
                  )}
                  <span className="truncate">{section.section}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {source === "user_confirmed" ? (
                    "用户确认事实"
                  ) : (
                    <>
                      <Sparkles aria-hidden="true" size={12} />
                      推测中
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

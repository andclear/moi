import { Eye, FilePenLine } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/button";

interface DossierEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
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
  onChange,
}: DossierEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

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
            className="h-full min-h-[46rem] w-full resize-y border border-[var(--echo-line)] bg-[rgba(2,16,24,0.46)] p-4 font-mono text-sm leading-7 text-[var(--echo-paper)] outline-none placeholder:text-[var(--echo-muted)] focus:border-[var(--echo-paper)]"
            spellCheck={false}
            aria-label="编辑 TA 的回音 Markdown"
          />
        ) : (
          <MarkdownPreview markdown={markdown} />
        )}
      </div>
    </div>
  );
}

import { CheckCircle2, Clock3, Eye, FilePenLine, Save, TriangleAlert } from "lucide-react";
import { useState } from "react";

import type { DossierSaveStatus } from "@/features/dossier/dossierStore";
import { Button } from "@/shared/components/ui/button";

interface DossierEditorProps {
  markdown: string;
  saveStatus: DossierSaveStatus;
  onChange: (markdown: string) => void;
  onSave: (markdown: string) => Promise<void>;
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
    <div className="space-y-5 font-mono text-sm leading-7 text-[var(--animal-text-muted)]">
      {markdown.split(/\n(?=##\s+)/).map((section) => {
        const [headingLine = "", ...bodyLines] = section.split(/\r?\n/);
        const heading = headingLine.replace(/^##\s+/, "").trim();
        const body = bodyLines.join("\n").trim();

        return (
          <section key={heading || section} className="border-b border-[var(--animal-border)] pb-4">
            {heading && (
              <h3 className="font-display text-lg font-black text-[var(--animal-text)]">
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
  saveStatus,
  onChange,
  onSave,
}: DossierEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [hasManualChanges, setHasManualChanges] = useState(false);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const isSaveError = saveStatus === "error";
  const SaveIcon =
    isManualSaving
      ? Clock3
      : isSaveError
          ? TriangleAlert
          : hasManualChanges
            ? Save
            : CheckCircle2;
  const saveLabel =
    isManualSaving
      ? "正在保存"
      : isSaveError
          ? "重新保存"
          : hasManualChanges
            ? "保存"
            : "已保存";
  const isSaveDisabled = isManualSaving || saveStatus === "loading";

  function handleChange(nextMarkdown: string) {
    setHasManualChanges(true);
    onChange(nextMarkdown);
  }

  async function handleSave() {
    setIsManualSaving(true);
    try {
      await onSave(markdown);
      setHasManualChanges(false);
    } finally {
      setIsManualSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-y-2 border-[var(--animal-border)] px-4 py-3">
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
        <Button
          type="button"
          size="sm"
          variant={hasManualChanges || isSaveError ? "primary" : "secondary"}
          onClick={() => void handleSave()}
          loading={isSaveDisabled}
          disabled={isSaveDisabled}
          aria-label="保存 TA 的回音"
        >
          {isSaveDisabled ? null : <SaveIcon aria-hidden="true" size={16} />}
          {saveLabel}
        </Button>
      </div>

      <div className="min-h-0 flex-[1_1_auto] overflow-auto p-4">
        {mode === "edit" ? (
          <textarea
            value={markdown}
            onChange={(event) => handleChange(event.target.value)}
            className="h-full min-h-[46rem] w-full resize-y border border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-4 font-mono text-sm leading-7 text-[var(--animal-text-body)] outline-none placeholder:text-[var(--animal-text-disabled)] focus:border-[var(--animal-focus-yellow)]"
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

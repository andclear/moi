import {
  CheckCircle2,
  Clock3,
  Eye,
  FilePenLine,
  PencilLine,
  Save,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import type { SyntheticEvent } from "react";

import type { DossierSaveStatus } from "@/features/dossier/dossierStore";
import { generateDossierTextRewrite } from "@/features/llm/llmClient";
import { Button } from "@/shared/components/ui/button";

interface DossierEditorProps {
  projectId: string | null;
  markdown: string;
  saveStatus: DossierSaveStatus;
  onChange: (markdown: string) => void;
  onSave: (markdown: string) => Promise<void>;
}

interface SelectionState {
  fragment: string;
  start: number;
  end: number;
  left: number;
  top: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSelectionRect(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
) {
  const textBefore = textarea.value.slice(0, start);
  const selectedText = textarea.value.slice(start, end) || "\u200b";
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");

  mirror.style.position = "fixed";
  mirror.style.top = `${-textarea.scrollTop}px`;
  mirror.style.left = `${-textarea.scrollLeft}px`;
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.zIndex = "-1";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflow = "hidden";
  mirror.style.boxSizing = computed.boxSizing;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.fontFamily = computed.fontFamily;
  mirror.style.fontSize = computed.fontSize;
  mirror.style.fontWeight = computed.fontWeight;
  mirror.style.fontStyle = computed.fontStyle;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
  mirror.style.borderRadius = computed.borderRadius;
  mirror.style.textTransform = computed.textTransform;
  mirror.style.textAlign = computed.textAlign;
  mirror.style.tabSize = computed.tabSize;

  mirror.innerHTML = `${escapeHtml(textBefore)}<span data-selection-target>${escapeHtml(selectedText)}</span>`;
  document.body.appendChild(mirror);
  const target = mirror.querySelector<HTMLSpanElement>("[data-selection-target]");
  const rect = target?.getBoundingClientRect();
  mirror.remove();

  return rect ?? null;
}

function replaceSelectedText(
  markdown: string,
  selection: SelectionState,
  replacement: string,
) {
  const currentSlice = markdown.slice(selection.start, selection.end);
  if (currentSlice === selection.fragment) {
    return markdown.slice(0, selection.start) + replacement + markdown.slice(selection.end);
  }

  const fallbackIndex = markdown.indexOf(selection.fragment);
  if (fallbackIndex >= 0) {
    return (
      markdown.slice(0, fallbackIndex) +
      replacement +
      markdown.slice(fallbackIndex + selection.fragment.length)
    );
  }

  return markdown;
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
  projectId,
  markdown,
  saveStatus,
  onChange,
  onSave,
}: DossierEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [hasManualChanges, setHasManualChanges] = useState(false);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
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

  function clearSelection() {
    setSelection(null);
  }

  function updateSelection(event: SyntheticEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const fragment = target.value.slice(start, end);

    if (!fragment.trim()) {
      setSelection(null);
      return;
    }

    const rect = getSelectionRect(target, start, end);
    const left = rect
      ? clamp(rect.left + rect.width / 2 - 52, 16, window.innerWidth - 190)
      : clamp(target.getBoundingClientRect().left + target.getBoundingClientRect().width - 160, 16, window.innerWidth - 190);
    const top = rect
      ? clamp(rect.top - 52 > 16 ? rect.top - 52 : rect.bottom + 10, 16, window.innerHeight - 120)
      : clamp(target.getBoundingClientRect().top + 24, 16, window.innerHeight - 120);

    setSelection({
      fragment,
      start,
      end,
      left,
      top,
    });
  }

  async function handleRewriteSelection() {
    if (!projectId || !selection || !revisionNotes.trim()) {
      return;
    }

    setIsRewriting(true);
    setRewriteError(null);

    try {
      const result = await generateDossierTextRewrite({
        projectId,
        dossierMarkdown: markdown,
        selectedFragment: selection.fragment,
        revisionNotes: revisionNotes.trim(),
      });
      const replacement = result.text.trim();
      if (!replacement) {
        throw new Error("AI 没有返回可替换的内容。");
      }

      const nextMarkdown = replaceSelectedText(markdown, selection, replacement);
      handleChange(nextMarkdown);
      setIsRevisionDialogOpen(false);
      setRevisionNotes("");
      clearSelection();
    } catch (error) {
      setRewriteError(error instanceof Error ? error.message : "修改失败，请重试。");
    } finally {
      setIsRewriting(false);
    }
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
    <>
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
            aria-label="保存 TA 的记录"
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
              onMouseUp={(event) => updateSelection(event)}
              onKeyUp={(event) => updateSelection(event)}
              onSelect={(event) => updateSelection(event)}
              className="h-full min-h-[46rem] w-full resize-y border border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-4 font-mono text-sm leading-7 text-[var(--animal-text-body)] outline-none placeholder:text-[var(--animal-text-disabled)] focus:border-[var(--animal-focus-yellow)]"
              spellCheck={false}
              aria-label="编辑 TA 的记录 Markdown"
            />
          ) : (
            <MarkdownPreview markdown={markdown} />
          )}
        </div>
      </div>

      {mode === "edit" && selection ? (
        <div
          className="fixed z-40"
          style={{ left: selection.left, top: selection.top }}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
        >
          <Button
            type="button"
            size="sm"
            className="min-w-20 border-[var(--animal-primary-active)] bg-[var(--animal-primary)] text-white shadow-[0_4px_0_0_var(--animal-primary-active)] hover:shadow-[0_5px_0_0_var(--animal-primary-active)]"
            onClick={() => setIsRevisionDialogOpen(true)}
          >
            <PencilLine aria-hidden="true" size={15} />
            修改
          </Button>
        </div>
      ) : null}

      {mode === "edit" && isRevisionDialogOpen && selection ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(61,52,40,0.38)] px-4 py-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsRevisionDialogOpen(false);
              setRewriteError(null);
            }
          }}
        >
          <section className="w-full max-w-2xl rounded-[var(--animal-radius)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-5 shadow-[0_18px_50px_rgba(61,52,40,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-black text-[var(--animal-text)]">修改这段内容</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--animal-text-muted)]">
                  选中的文本会被重新改写，下面填写你希望怎么改。
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="关闭修改弹窗"
                onClick={() => {
                  setIsRevisionDialogOpen(false);
                  setRewriteError(null);
                }}
              >
                <X aria-hidden="true" size={18} />
              </Button>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="rounded-[var(--animal-radius)] border-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.4)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--animal-primary)]">
                  选中的内容
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold leading-7 text-[var(--animal-text-body)]">
                  {selection.fragment}
                </p>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-black text-[var(--animal-text)]">修改意见</span>
                <textarea
                  value={revisionNotes}
                  onChange={(event) => setRevisionNotes(event.target.value)}
                  className="min-h-28 resize-y rounded-[var(--animal-radius)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg)] p-4 text-sm font-bold leading-7 text-[var(--animal-text-body)] outline-none focus:border-[var(--animal-focus-yellow)]"
                  placeholder="告诉 AI 你想怎么改这段文字"
                />
              </label>

              {rewriteError ? (
                <p className="rounded-[var(--animal-radius)] border-2 border-[var(--animal-error)] bg-[rgba(224,90,90,0.1)] p-3 text-sm font-bold leading-6 text-[var(--animal-error-active)]">
                  {rewriteError}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsRevisionDialogOpen(false);
                  setRewriteError(null);
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                loading={isRewriting}
                disabled={isRewriting || !revisionNotes.trim()}
                className="min-w-40 border-[var(--animal-primary-active)] bg-[var(--animal-primary)] text-white shadow-[0_5px_0_0_var(--animal-primary-active)] hover:shadow-[0_6px_0_0_var(--animal-primary-active)]"
                onClick={() => void handleRewriteSelection()}
              >
                确认修改
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

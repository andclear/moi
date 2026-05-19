import { CheckCircle2, Clock3, LockKeyhole, PenLine, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router";

import { DossierEditor } from "@/features/dossier/DossierEditor";
import { useDossierStore } from "@/features/dossier/dossierStore";

export function DossierPanel() {
  const { projectId } = useParams();
  const {
    markdown,
    saveStatus,
    errorMessage,
    loadProject,
    updateMarkdown,
  } = useDossierStore();

  useEffect(() => {
    if (projectId) {
      void loadProject(projectId);
    }
  }, [projectId, loadProject]);

  const statusText =
    saveStatus === "saving"
      ? "正在保存"
      : saveStatus === "saved"
        ? "已保存"
        : saveStatus === "error"
          ? "保存失败"
          : "等待记录";
  const StatusIcon =
    saveStatus === "saving" ? Clock3 : saveStatus === "error" ? TriangleAlert : CheckCircle2;

  return (
    <aside className="flex h-full flex-col border-l-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)]">
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
              TA 的记录
            </p>
            <h2 className="mt-2 font-display text-2xl font-black text-[var(--animal-text)]">
              岛民笔记
            </h2>
          </div>
          <LockKeyhole aria-hidden="true" size={20} className="text-[var(--echo-muted)]" />
        </div>
        <div className="mt-4 flex items-center gap-2 font-mono text-xs text-[var(--echo-muted)]">
          <StatusIcon aria-hidden="true" size={15} />
          <span>{statusText}</span>
        </div>
        {errorMessage && (
          <p className="mt-3 font-mono text-xs leading-5 text-[var(--echo-stamp)]">
            {errorMessage}
          </p>
        )}
      </div>

      {projectId ? (
        <DossierEditor
          markdown={markdown}
          saveStatus={saveStatus}
          onChange={(nextMarkdown) => void updateMarkdown(nextMarkdown)}
          onSave={updateMarkdown}
        />
      ) : (
        <div className="p-5">
          <p className="font-mono text-sm leading-6 text-[var(--echo-muted)]">
            先写下一张岛民便笺，TA 的记录会在这里慢慢整理出来。
          </p>
          <div className="mt-6 rounded-[var(--animal-radius)] border border-dashed border-[var(--animal-border)] bg-[rgba(255,255,255,0.42)] p-4 font-mono text-sm leading-7 text-[var(--animal-text-muted)]">
            <div className="flex items-center gap-2 text-[var(--animal-text)]">
              <PenLine aria-hidden="true" size={16} />
              <span>等待第一条记录</span>
            </div>
            <div className="mt-4">
              ## 核心人格
              <br />
              尚未听见
              <br />
              <br />
              ## 世界观
              <br />
              尚未听见
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

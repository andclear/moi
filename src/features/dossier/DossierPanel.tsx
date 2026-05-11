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
          : "等待回音";
  const StatusIcon =
    saveStatus === "saving" ? Clock3 : saveStatus === "error" ? TriangleAlert : CheckCircle2;

  return (
    <aside className="flex h-full flex-col border-l border-[var(--echo-line)] bg-[rgba(18,33,42,0.96)]">
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
              TA 的回音
            </p>
            <h2 className="mt-2 font-display text-2xl font-black text-[var(--echo-paper)]">
              回音墙
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
          onSave={(nextMarkdown) => void updateMarkdown(nextMarkdown)}
        />
      ) : (
        <div className="p-5">
          <p className="font-mono text-sm leading-6 text-[var(--echo-muted)]">
            先贴出一张寻人启事，TA 的回音会在这里慢慢显现。
          </p>
          <div className="mt-6 border border-dashed border-[var(--echo-line)] bg-[rgba(2,16,24,0.36)] p-4 font-mono text-sm leading-7 text-[var(--echo-muted)]">
            <div className="flex items-center gap-2 text-[var(--echo-paper)]">
              <PenLine aria-hidden="true" size={16} />
              <span>等待第一条线索</span>
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

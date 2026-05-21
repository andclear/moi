import { Download, FileText } from "lucide-react";
import { useMemo, useState } from "react";

import type { Project } from "@/db/types";
import { buildProfileReportHtml, createReportFileName } from "@/features/report/profileReport";
import { downloadText } from "@/features/export/exportStore";
import { Button } from "@/shared/components/ui/button";

interface ProfileReportPanelProps {
  project: Project;
}

export function ProfileReportPanel({ project }: ProfileReportPanelProps) {
  const [versionLabel, setVersionLabel] = useState("1.0");
  const html = useMemo(() => buildProfileReportHtml(project, versionLabel), [project, versionLabel]);

  function handleDownload() {
    downloadText(html, createReportFileName(project, versionLabel), "text/html;charset=utf-8");
  }

  return (
    <section className="border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4 sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            侧写报告
          </p>
          <h2 className="mt-2 font-display text-3xl font-black text-[var(--echo-paper)]">
            岛民报告
          </h2>
          <p className="mt-2 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            生成纪念性质的 HTML 页面，记录 TA 被一点点找到的过程。
          </p>
        </div>

        <div className="min-w-0">
          <div className="grid gap-3 rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.36)] p-4 sm:flex sm:flex-wrap sm:items-end">
            <label className="grid min-w-0 flex-1 gap-2 text-sm font-bold text-[var(--echo-paper)] sm:min-w-48">
              报告版本
              <input
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                className="h-11 border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 font-mono text-sm text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
              />
            </label>
            <Button
              type="button"
              className="w-full border-[var(--animal-primary-active)] bg-[var(--animal-primary)] text-white shadow-[0_5px_0_0_var(--animal-primary-active)] hover:bg-[var(--animal-primary-hover)] hover:shadow-[0_6px_0_0_var(--animal-primary-active)] sm:w-fit"
              onClick={handleDownload}
            >
              <Download aria-hidden="true" size={18} />
              下载报告
            </Button>
          </div>

          <div className="mt-4 rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3">
            <p className="flex items-center gap-2 font-mono text-sm font-bold text-[var(--echo-paper)]">
              <FileText aria-hidden="true" size={17} />
              浏览器预览
            </p>
            <iframe
              title="岛民报告预览"
              srcDoc={html}
              className="mt-3 h-[min(34rem,62vh)] w-full rounded-[var(--animal-radius-sm)] border border-[var(--echo-line)] bg-white"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

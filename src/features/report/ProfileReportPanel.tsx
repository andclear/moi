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
    <section className="border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
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
        <Button type="button" onClick={handleDownload}>
          <Download aria-hidden="true" size={18} />
          下载报告
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <label className="grid gap-2 text-sm font-bold text-[var(--echo-paper)]">
          报告版本
          <input
            value={versionLabel}
            onChange={(event) => setVersionLabel(event.target.value)}
            className="h-11 border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 font-mono text-sm text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
          />
        </label>
        <div className="border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3">
          <p className="flex items-center gap-2 font-mono text-sm font-bold text-[var(--echo-paper)]">
            <FileText aria-hidden="true" size={17} />
            浏览器预览
          </p>
          <iframe
            title="岛民报告预览"
            srcDoc={html}
            className="mt-3 h-[32rem] w-full border border-[var(--echo-line)] bg-white"
          />
        </div>
      </div>
    </section>
  );
}

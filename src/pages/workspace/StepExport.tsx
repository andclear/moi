import { Archive, Download, FileJson, ImageUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { exportRepository } from "@/db/repositories/exportRepository";
import { projectService } from "@/db/services/projectService";
import type { ExportRecord, Project } from "@/db/types";
import { CompanionNetwork } from "@/features/companions/CompanionNetwork";
import { useExportStore } from "@/features/export/exportStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { getAdoptedGreetingVariants } from "@/features/greeting/greetingStore";
import { ProfileReportPanel } from "@/features/report/ProfileReportPanel";
import { Button } from "@/shared/components/ui/button";

export function StepExport() {
  const { projectId } = useParams();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const { status, error, lastRecord, buildJson, buildPng } = useExportStore();
  const [project, setProject] = useState<Project>();
  const [records, setRecords] = useState<ExportRecord[]>([]);
  const [versionLabel, setVersionLabel] = useState("1.0");
  const [note, setNote] = useState("");
  const [imageFile, setImageFile] = useState<File>();
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    let mounted = true;

    projectService
      .resolveProject(projectId)
      .then(async (resolvedProject) => {
        if (!mounted) {
          return;
        }
        if (!resolvedProject) {
          setPageError("这里还没有 TA 的记录。");
          return;
        }
        setProject(resolvedProject);
        setRecords(await exportRepository.listByProject(resolvedProject.id));
      })
      .catch((loadError: unknown) => {
        if (mounted) {
          setPageError(loadError instanceof Error ? loadError.message : "读取导出信息失败。");
        }
      });

    return () => {
      mounted = false;
    };
  }, [projectId, lastRecord]);

  const selectedGreeting = useMemo(
    () => (project ? getAdoptedGreetingVariants(project)[0] : undefined),
    [project],
  );
  const confirmedWorldCount = project?.worldEntries.filter((entry) => entry.enabled).length ?? 0;
  const latestTrial = project?.trialRuns[0];
  const enabledBeautificationCount = project?.beautifications?.filter((asset) => asset.enabled).length ?? 0;
  const confirmedCompanionCount = project?.companions?.filter((node) => node.status === "confirmed").length ?? 0;
  const isBuilding = status === "building";

  async function handleJsonExport() {
    if (!project) {
      return;
    }

    await buildJson({ project, versionLabel, note });
    markStepCompleted("export");
  }

  async function handlePngExport() {
    if (!project || !imageFile) {
      setPageError("请先上传一张 JPG、PNG 或 WebP 图片作为载体。");
      return;
    }

    setPageError("");
    await buildPng({ project, versionLabel, note, imageFile });
    markStepCompleted("export");
  }

  if (pageError && !project) {
    return (
      <section className="p-6">
        <div className="border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-8 text-[var(--echo-paper)]">
          {pageError}
        </div>
      </section>
    );
  }

  return (
    <section className="echo-workspace-page">
      <div className="echo-readable-shell echo-workspace-inner">
        <article className="echo-section-card">
          <Archive aria-hidden="true" size={26} className="text-[var(--echo-paper)]" />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            带 TA 回来
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
            导出记录
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            将已确认的记录、WorldInfo、开场白和相处测试记录整理为 SillyTavern Character Card V3。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <label className="grid gap-2 text-sm font-bold text-[var(--echo-paper)]">
              版本
              <input
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                className="h-11 border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 font-mono text-sm text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[var(--echo-paper)]">
              备注
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                className="resize-y border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                placeholder="写下这次把 TA 带回来的备注。"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4">
              <FileJson aria-hidden="true" size={22} className="text-[var(--echo-paper)]" />
              <h2 className="mt-3 font-display text-2xl font-black text-[var(--echo-paper)]">
                格式化 JSON
              </h2>
              <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                直接下载可解析的 Character Card V3 JSON。
              </p>
              <Button
                type="button"
                className="mt-5"
                loading={isBuilding}
                disabled={!project || isBuilding}
                onClick={() => void handleJsonExport()}
              >
                {isBuilding ? null : <Download aria-hidden="true" size={18} />}
                导出 JSON
              </Button>
            </section>

            <section className="border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4">
              <ImageUp aria-hidden="true" size={22} className="text-[var(--echo-paper)]" />
              <h2 className="mt-3 font-display text-2xl font-black text-[var(--echo-paper)]">
                内嵌 PNG
              </h2>
              <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                上传 JPG、PNG 或 WebP，转换为 PNG 后写入 chara 与 ccv3 文本区块。
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setImageFile(event.target.files?.[0])}
                className="mt-4 block w-full text-sm text-[var(--echo-muted)] file:mr-4 file:h-10 file:border-2 file:border-[var(--echo-line)] file:bg-[var(--animal-bg-content)] file:px-4 file:font-bold file:text-[var(--echo-ink)]"
              />
              <Button
                type="button"
                className="mt-5"
                loading={isBuilding}
                disabled={!project || isBuilding}
                onClick={() => void handlePngExport()}
              >
                {isBuilding ? null : <Download aria-hidden="true" size={18} />}
                导出 PNG
              </Button>
            </section>
          </div>

          {(error || pageError) && (
            <p className="mt-5 border border-[var(--echo-stamp)] bg-[rgba(120,40,34,0.18)] p-3 font-mono text-sm text-[var(--echo-paper)]">
              {error || pageError}
            </p>
          )}
        </article>

        <aside className="echo-side-panel space-y-4">
          <section>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
              导出内容
            </p>
            <dl className="mt-4 space-y-3 font-mono text-sm text-[var(--echo-muted)]">
              <div>
                <dt className="font-bold text-[var(--echo-paper)]">记录</dt>
                <dd>{project?.title ?? "读取中"}</dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--echo-paper)]">WorldInfo</dt>
                <dd>{confirmedWorldCount} 条已确认</dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--echo-paper)]">开场白</dt>
                <dd>{selectedGreeting ? "已采用" : "尚未采用"}</dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--echo-paper)]">相处测试</dt>
                <dd>{latestTrial ? new Date(latestTrial.createdAt).toLocaleString() : "尚未通过"}</dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--echo-paper)]">美化</dt>
                <dd>{enabledBeautificationCount} 套会写入 JSON</dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--echo-paper)]">关系网</dt>
                <dd>{confirmedCompanionCount} 位旁人已确认</dd>
              </div>
            </dl>
          </section>

          <section className="border-t-2 border-[var(--animal-border)] pt-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
              导出记录
            </p>
            <div className="mt-4 space-y-3">
              {records.length ? (
                records.map((record) => (
                  <div key={record.id} className="border border-[var(--echo-line)] p-3 font-mono text-xs text-[var(--echo-muted)]">
                    <p className="font-bold uppercase text-[var(--echo-paper)]">{record.format}</p>
                    <p className="mt-1">{new Date(record.createdAt).toLocaleString()}</p>
                    {record.versionLabel && <p className="mt-1">版本：{record.versionLabel}</p>}
                  </div>
                ))
              ) : (
                <p className="font-mono text-sm text-[var(--echo-muted)]">还没有导出记录。</p>
              )}
            </div>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link to="/library">回到岛民册</Link>
            </Button>
          </section>
        </aside>
      </div>

      {project && (
        <div className="echo-workspace-inner mt-6 space-y-6">
          <CompanionNetwork project={project} onProjectChange={setProject} />
          <ProfileReportPanel project={project} />
        </div>
      )}
    </section>
  );
}

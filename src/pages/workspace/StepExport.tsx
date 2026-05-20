import { Archive, Download, FileJson, ImageUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { exportRepository } from "@/db/repositories/exportRepository";
import { projectService } from "@/db/services/projectService";
import type { ExportRecord, Project } from "@/db/types";
import { useExportStore } from "@/features/export/exportStore";
import { useFlowStore } from "@/features/flow/flowStore";
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

  const latestRecord = useMemo(() => records[0], [records]);
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
        <article className="echo-section-card min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
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
            </div>
            {latestRecord && (
              <div className="w-full rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.38)] p-4 font-mono text-sm text-[var(--echo-muted)] sm:w-auto sm:min-w-56">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-paper)]">
                  最近导出
                </p>
                <p className="mt-2 font-bold uppercase">{latestRecord.format}</p>
                <p className="mt-1 text-xs">{new Date(latestRecord.createdAt).toLocaleString()}</p>
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)]">
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

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <section className="flex min-h-56 flex-col rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5">
              <div className="flex items-start gap-3">
                <FileJson aria-hidden="true" size={22} className="mt-1 shrink-0 text-[var(--echo-paper)]" />
                <div>
                  <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
                    格式化 JSON
                  </h2>
                  <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                    直接下载可解析的 Character Card V3 JSON。
                  </p>
                </div>
              </div>
              <Button
                type="button"
                className="mt-auto w-full sm:w-fit"
                loading={isBuilding}
                disabled={!project || isBuilding}
                onClick={() => void handleJsonExport()}
              >
                {isBuilding ? null : <Download aria-hidden="true" size={18} />}
                导出 JSON
              </Button>
            </section>

            <section className="flex min-h-56 flex-col rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5">
              <div className="flex items-start gap-3">
                <ImageUp aria-hidden="true" size={22} className="mt-1 shrink-0 text-[var(--echo-paper)]" />
                <div>
                  <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
                    内嵌 PNG
                  </h2>
                  <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                    上传 JPG、PNG 或 WebP，转换为 PNG 后写入 chara 与 ccv3 文本区块。
                  </p>
                </div>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setImageFile(event.target.files?.[0])}
                className="mt-4 block w-full text-sm text-[var(--echo-muted)] file:mr-4 file:h-10 file:border-2 file:border-[var(--echo-line)] file:bg-[var(--animal-bg-content)] file:px-4 file:font-bold file:text-[var(--echo-ink)]"
              />
              <Button
                type="button"
                className="mt-auto w-full sm:w-fit"
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

        <aside className="echo-side-panel h-fit">
          <section>
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
        <div className="echo-workspace-inner mt-6">
          <ProfileReportPanel project={project} />
        </div>
      )}
    </section>
  );
}

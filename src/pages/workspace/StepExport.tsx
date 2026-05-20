import { Archive, Download, FileJson, ImageUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { projectService } from "@/db/services/projectService";
import type { Project } from "@/db/types";
import { useExportStore } from "@/features/export/exportStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { ProfileReportPanel } from "@/features/report/ProfileReportPanel";
import { Button } from "@/shared/components/ui/button";

export function StepExport() {
  const { projectId } = useParams();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const { status, error, buildJson, buildPng } = useExportStore();
  const [project, setProject] = useState<Project>();
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
      })
      .catch((loadError: unknown) => {
        if (mounted) {
          setPageError(loadError instanceof Error ? loadError.message : "读取导出信息失败。");
        }
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

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
      <div className="echo-workspace-inner space-y-6">
        <article className="echo-section-card min-w-0">
          <div className="grid gap-8 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
            <div className="min-w-0 self-start">
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

            <div className="grid min-w-0 gap-5">
              <div className="grid gap-4 rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.36)] p-5 md:grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)]">
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
                    rows={3}
                    className="resize-y border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                    placeholder="写下这次把 TA 带回来的备注。"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5">
                  <div className="flex items-start gap-3">
                    <FileJson aria-hidden="true" size={22} className="mt-1 shrink-0 text-[var(--echo-paper)]" />
                    <div>
                      <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
                        格式化 JSON
                      </h2>
                      <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                        下载可解析的 Character Card V3 JSON。
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="mt-6 w-full sm:w-fit"
                    loading={isBuilding}
                    disabled={!project || isBuilding}
                    onClick={() => void handleJsonExport()}
                  >
                    {isBuilding ? null : <Download aria-hidden="true" size={18} />}
                    导出 JSON
                  </Button>
                </section>

                <section className="rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5">
                  <div className="flex items-start gap-3">
                    <ImageUp aria-hidden="true" size={22} className="mt-1 shrink-0 text-[var(--echo-paper)]" />
                    <div>
                      <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
                        内嵌 PNG
                      </h2>
                      <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                        上传图片，写入 chara 与 ccv3 文本区块。
                      </p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setImageFile(event.target.files?.[0])}
                    className="mt-5 block w-full text-sm text-[var(--echo-muted)] file:mr-4 file:h-10 file:border-2 file:border-[var(--echo-line)] file:bg-[var(--animal-bg-content)] file:px-4 file:font-bold file:text-[var(--echo-ink)]"
                  />
                  <Button
                    type="button"
                    className="mt-6 w-full sm:w-fit"
                    loading={isBuilding}
                    disabled={!project || isBuilding}
                    onClick={() => void handlePngExport()}
                  >
                    {isBuilding ? null : <Download aria-hidden="true" size={18} />}
                    导出 PNG
                  </Button>
                </section>
              </div>
            </div>
          </div>

          {(error || pageError) && (
            <p className="mt-5 border border-[var(--echo-stamp)] bg-[rgba(120,40,34,0.18)] p-3 font-mono text-sm text-[var(--echo-paper)]">
              {error || pageError}
            </p>
          )}
        </article>

        {project && <ProfileReportPanel project={project} />}
      </div>
    </section>
  );
}

import { Copy, FileArchive, History, PencilLine, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { exportRepository } from "@/db/repositories/exportRepository";
import { generationRepository } from "@/db/repositories/generationRepository";
import { projectService } from "@/db/services/projectService";
import { historyService } from "@/db/services/historyService";
import type { ExportRecord, HistorySnapshot, Project } from "@/db/types";
import { parseDossierSections } from "@/features/dossier/dossierSections";
import { buildCharacterCard, formatCharacterCardJson } from "@/features/export/characterCardBuilder";
import { downloadText } from "@/features/export/exportStore";
import { createEmptyProfileSession } from "@/features/profile/profileSession";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { HistoryTimeline } from "@/shared/components/HistoryTimeline";
import { Button } from "@/shared/components/ui/button";

interface ProjectLibraryItem {
  project: Project;
  exports: ExportRecord[];
  histories: HistorySnapshot[];
}

function hasRecognizableDossier(markdown: string) {
  return parseDossierSections(markdown).some(
    (block) =>
      block.section !== "最初的回音" &&
      block.section !== "最初的印象" &&
      block.content.trim() &&
      block.content.trim() !== "尚未听见",
  );
}

export function LibraryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectLibraryItem[]>([]);
  const [expandedProjectId, setExpandedProjectId] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<Project>();
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    loadItems().catch((loadError: unknown) => {
      if (mounted) {
        setError(loadError instanceof Error ? loadError.message : "读取岛民册失败。");
      }
    });

    return () => {
      mounted = false;
    };

    async function loadItems() {
      const projects = await projectService.listActiveProjects();
      const nextItems = await Promise.all(
        projects.map((project) => buildLibraryItem(project)),
      );
      if (mounted) {
        setItems(nextItems);
      }
    }
  }, []);

  async function reload() {
    const projects = await projectService.listActiveProjects();
    setItems(
      await Promise.all(
        projects.map((project) => buildLibraryItem(project)),
      ),
    );
  }

  async function buildLibraryItem(project: Project): Promise<ProjectLibraryItem> {
    let normalizedProject = project;
    const generations = await generationRepository.listByProject(project.id);
    const hasInitialProfileOutput = generations.some(
      (task) => task.type === "profile" && task.status === "succeeded",
    );

    if (
      project.currentStep === "post" &&
      (hasRecognizableDossier(project.dossier.markdown) || hasInitialProfileOutput)
    ) {
      normalizedProject =
        (await projectService.updateProject(project.id, {
          currentStep: "profile",
          profileSession: project.profileSession ?? createEmptyProfileSession(),
        })) ?? project;
    }

    return {
      project: normalizedProject,
      exports: await exportRepository.listByProject(project.id),
      histories: await historyService.listProjectSnapshots(project.id),
    };
  }

  async function handleCopy(project: Project) {
    const copied = await projectService.copyProject(project.id);
    await reload();
    void navigate(`/workspace/${copied.id}/${copied.currentStep}`);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    await projectService.deleteProject(deleteTarget.id);
    setDeleteTarget(undefined);
    await reload();
  }

  async function handleRestore(historyId: string) {
    const restored = await historyService.restoreSnapshot(historyId);
    await reload();
    void navigate(`/workspace/${restored.id}/${restored.currentStep}`);
  }

  async function handleCopyHistory(historyId: string) {
    const copied = await historyService.copySnapshot(historyId);
    await reload();
    void navigate(`/workspace/${copied.id}/${copied.currentStep}`);
  }

  async function handleReexport(project: Project) {
    const card = buildCharacterCard({ project, versionLabel: "library-reexport" });
    const formattedJson = formatCharacterCardJson(card);
    await exportRepository.create({
      projectId: project.id,
      format: "json",
      versionLabel: "library-reexport",
      jsonPreview: formattedJson.slice(0, 5000),
    });
    downloadText(formattedJson, `${project.title.replace(/[\\/:*?"<>|]/g, "_") || "echo-character"}.json`);
    await reload();
  }

  return (
    <section className="border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
            本地岛民册
          </p>
          <h1 className="mt-3 font-display text-3xl font-black text-[var(--echo-paper)]">
            我的岛民记录
          </h1>
        </div>
        <Button asChild>
          <Link to="/workspace">
            <Plus aria-hidden="true" size={18} />
            寻找新的 TA
          </Link>
        </Button>
      </div>
      {error && (
        <p className="mt-5 border border-[var(--echo-stamp)] bg-[rgba(120,40,34,0.16)] p-3 font-mono text-sm text-[var(--echo-paper)]">
          {error}
        </p>
      )}
      {items.length > 0 ? (
        <div className="mt-8 grid gap-4">
          {items.map(({ project, exports, histories }) => (
            <article
              key={project.id}
              className="border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-display text-xl font-black text-[var(--echo-paper)]">
                    {project.title}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--echo-muted)]">
                    当前阶段：{project.currentStep} · 更新于 {new Date(project.updatedAt).toLocaleString()}
                  </p>
                  <p className="mt-2 font-mono text-sm text-[var(--echo-muted)]">
                    导出状态：{exports[0] ? `${exports[0].format.toUpperCase()} · ${new Date(exports[0].createdAt).toLocaleString()}` : "尚未导出"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to={`/workspace/${project.id}/${project.currentStep}`}>
                      <PencilLine aria-hidden="true" size={15} />
                      继续
                    </Link>
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void handleCopy(project)}>
                    <Copy aria-hidden="true" size={15} />
                    复制
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void handleReexport(project)}>
                    <RefreshCw aria-hidden="true" size={15} />
                    重新导出
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTarget(project)}>
                    <Trash2 aria-hidden="true" size={15} />
                    删除
                  </Button>
                </div>
              </div>

              <div className="mt-4 border-t border-[var(--echo-line)] pt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setExpandedProjectId(expandedProjectId === project.id ? undefined : project.id)
                  }
                >
                  <History aria-hidden="true" size={15} />
                  {expandedProjectId === project.id ? "收起历史" : "查看历史"}
                </Button>
                {expandedProjectId === project.id && (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <HistoryTimeline histories={histories} onRestore={(id) => void handleRestore(id)} />
                    <div className="space-y-3">
                      {histories.length ? (
                        histories.map((history) => (
                          <Button
                            key={history.id}
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleCopyHistory(history.id)}
                          >
                            从“{history.title}”复制新版本
                          </Button>
                        ))
                      ) : (
                        <p className="font-mono text-sm text-[var(--echo-muted)]">
                          这个记录还没有可复制的历史节点。
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8 flex min-h-72 flex-col items-center justify-center border border-dashed border-[var(--echo-line)] text-center">
          <FileArchive aria-hidden="true" size={40} className="text-[var(--echo-muted)]" />
          <p className="mt-4 font-bold text-[var(--echo-paper)]">还没有来到小岛的 TA</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--echo-muted)]">
            从一张岛民便笺开始，慢慢把 TA 找回来。
          </p>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="确认删除这个记录？"
        description="删除后会清理这个记录关联的历史、生成记录和导出记录，无法从本地恢复。"
        confirmLabel="删除"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(undefined)}
      />
    </section>
  );
}

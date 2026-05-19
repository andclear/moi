import { BookMarked, GitMerge, Lightbulb, Plus, Trash2, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type { Project, WorldEntry } from "@/db/types";
import { historyService } from "@/db/services/historyService";
import { projectService } from "@/db/services/projectService";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { useGenerationStore } from "@/features/generation/generationStore";
import { generateWorldEntries } from "@/features/llm/llmClient";
import { useSettingsStore } from "@/features/settings/settingsStore";
import {
  confirmWorldEntry,
  createWorldEntryCandidates,
  formatWorldInfoForDossier,
  getConfirmedWorldEntries,
  removeWorldEntry,
  syncWorldInfoToDossier,
  upsertWorldEntry,
} from "@/features/world/worldStore";
import { EmptyState } from "@/shared/components/EmptyState";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";

export function StepWorld() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRequest, setUserRequest] = useState("");
  const [entryCount, setEntryCount] = useState(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const generationKey = project ? `world:${project.id}:entries` : "world:pending";
  const generationTask = useGenerationStore((state) => state.getTask(generationKey));
  const setRunning = useGenerationStore((state) => state.setRunning);
  const setSucceeded = useGenerationStore((state) => state.setSucceeded);
  const setFailed = useGenerationStore((state) => state.setFailed);
  const cancel = useGenerationStore((state) => state.cancel);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let ignored = false;

    async function loadProject() {
      setIsLoading(true);
      const resolvedProject = await projectService.resolveProject(projectId);
      if (!ignored) {
        if (resolvedProject) {
          hydrateFromProject(resolvedProject);
        }
        setProject(resolvedProject ?? null);
        setIsLoading(false);
      }
    }

    void loadProject();
    return () => {
      ignored = true;
    };
  }, [hydrateFromProject, projectId]);

  const confirmedEntries = useMemo(() => {
    return project ? getConfirmedWorldEntries(project) : [];
  }, [project]);

  async function persistProject(nextProject: Project, snapshotTitle?: string, generationIds: string[] = []) {
    const { id, createdAt, ...patch } = nextProject;
    void createdAt;
    const updatedProject = await projectService.updateProject(id, patch);
    if (updatedProject) {
      hydrateFromProject(updatedProject);
      setProject(updatedProject);
      if (snapshotTitle) {
        await historyService.createSnapshot(updatedProject.id, snapshotTitle, generationIds);
      }
    }
    return updatedProject;
  }

  async function handleGenerateWorld() {
    if (!project) {
      return;
    }

    const trimmedRequest = userRequest.trim();
    if (!trimmedRequest) {
      setErrorMessage("请先描述这次想生成的世界书内容。");
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    const controller = new AbortController();
    setErrorMessage(null);
    setRunning(generationKey, controller);

    try {
      const result = await generateWorldEntries({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        confirmedEntries,
        userRequest: trimmedRequest,
        entryCount,
        signal: controller.signal,
      });
      const candidates = createWorldEntryCandidates(project.id, result.data);
      const nextProject = {
        ...project,
        worldEntries: [...candidates, ...project.worldEntries],
      };

      await persistProject(nextProject, `生成 ${candidates.length} 条 WorldInfo`, [result.taskId]);
      setSucceeded(generationKey, result.taskId);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "世界书生成失败。";
      setErrorMessage(message);
      setFailed(generationKey, message);
    }
  }

  async function handleEditEntry(entry: WorldEntry, patch: Partial<WorldEntry>) {
    if (!project) {
      return;
    }

    const updated = upsertWorldEntry(project, { ...entry, ...patch });
    const synced = syncWorldInfoToDossier(updated);
    await persistProject(synced);
  }

  async function handleConfirmEntry(entry: WorldEntry) {
    if (!project) {
      return;
    }

    await persistProject(confirmWorldEntry(project, entry.id), `确认 WorldInfo：${entry.title}`);
  }

  async function handleDiscardEntry(entry: WorldEntry) {
    if (!project) {
      return;
    }

    const nextProject = syncWorldInfoToDossier(removeWorldEntry(project, entry.id));
    await persistProject(nextProject, `舍弃 WorldInfo：${entry.title}`);
  }

  async function handleNextStep() {
    if (!project) {
      return;
    }

    const nextProject = {
      ...syncWorldInfoToDossier(project),
      currentStep: "greeting" as const,
    };
    const updatedProject = await persistProject(nextProject, "完成世界书阶段");
    if (updatedProject) {
      markStepCompleted("world");
      navigate(`/workspace/${updatedProject.id}/greeting`);
    }
  }

  if (isLoading) {
    return <div className="p-6 font-mono text-sm text-[var(--echo-muted)]">正在翻找世界的纹理……</div>;
  }

  if (!project) {
    return (
      <div className="p-6">
        <EmptyState title="这里还没有 TA" description="先从岛民便笺开始，才能为 TA 整理世界。" />
      </div>
    );
  }

  return (
    <main className="echo-workspace-page">
      <div className="echo-workspace-inner space-y-6">
        <section className="echo-section-card">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            WorldInfo
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
            为 TA 整理生活过的世界
          </h1>
          <p className="mt-3 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            每次最多生成三条。只有你确认过的 WorldInfo 会进入后续上下文；被舍弃的条目不会再参与生成。
          </p>
        </section>

        <section className="echo-readable-shell">
          <div className="echo-readable-main">
            <div className="echo-section-card">
              <label className="block">
                <span className="font-display text-xl font-black text-[var(--echo-paper)]">
                  这次想生成什么样的世界书？
                </span>
                <span className="mt-2 block font-mono text-sm leading-7 text-[var(--echo-muted)]">
                  直接描述你想补全的世界书方向。系统会结合已生成的岛民档案与已确认
                  WorldInfo 来生成，不会额外加入预设主题。
                </span>
                <textarea
                  value={userRequest}
                  onChange={(event) => setUserRequest(event.target.value)}
                  placeholder="例如：补全 TA 所在组织的规矩、TA 居住区域的日常秩序、或某段会影响 TA 行动的历史背景。"
                  className="mt-3 min-h-40 w-full resize-y border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4 font-mono text-base leading-8 text-[var(--echo-text)] outline-none placeholder:text-[var(--echo-muted)] focus:border-[var(--echo-paper)]"
                />
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="font-mono text-xs text-[var(--echo-muted)]">
                  本次条数
                  <select
                    value={entryCount}
                    onChange={(event) => setEntryCount(Number(event.target.value))}
                    className="ml-2 border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 py-2 text-[var(--echo-text)]"
                  >
                    <option value={1}>1 条</option>
                    <option value={2}>2 条</option>
                    <option value={3}>3 条</option>
                  </select>
                </label>
                <GenerationButton
                  idleLabel="生成 WorldInfo"
                  runningLabel="正在整理"
                  retryLabel="重新整理"
                  status={generationTask.status}
                  errorMessage={errorMessage ?? generationTask.errorMessage}
                  onGenerate={handleGenerateWorld}
                  onCancel={() => cancel(generationKey)}
                />
              </div>
            </div>

            <div className="grid gap-4">
              {project.worldEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="echo-text-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <input
                      value={entry.title}
                      onChange={(event) => void handleEditEntry(entry, { title: event.target.value })}
                      className="min-w-0 flex-1 bg-transparent font-display text-2xl font-black text-[var(--echo-paper)] outline-none"
                    />
                    <span className="border border-[var(--echo-line)] px-2 py-1 font-mono text-[0.68rem] text-[var(--echo-muted)]">
                      {entry.enabled ? "已确认" : "待确认"}
                    </span>
                  </div>
                  <textarea
                    value={entry.content}
                    onChange={(event) => void handleEditEntry(entry, { content: event.target.value })}
                    className="mt-4 min-h-72 w-full resize-y border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4 font-mono text-base leading-8 text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                  />
                  <input
                    value={entry.keywords.join("、")}
                    onChange={(event) =>
                      void handleEditEntry(entry, {
                        keywords: event.target.value
                          .split(/[、,\s]+/)
                          .map((keyword) => keyword.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="关键词，用顿号分隔"
                    className="mt-3 w-full border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 py-2 font-mono text-xs text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleConfirmEntry(entry)}
                      disabled={entry.enabled}
                    >
                      <Plus aria-hidden="true" size={15} />
                      确认
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setUserRequest(`深挖「${entry.title}」：补出它的维护代价、历史伤痕与和 TA 的牵连。`)}>
                      <Lightbulb aria-hidden="true" size={15} />
                      深挖
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setUserRequest(`从「${entry.title}」联想一个缺失但必要的 WorldInfo 条目。`)}>
                      <GitMerge aria-hidden="true" size={15} />
                      联想
                    </Button>
                    <Button type="button" size="sm" variant="ghost" danger onClick={() => void handleDiscardEntry(entry)}>
                      <Trash2 aria-hidden="true" size={15} />
                      舍弃
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="echo-side-panel">
            <BookMarked aria-hidden="true" size={22} className="text-[var(--echo-muted)]" />
            <h2 className="mt-3 font-display text-2xl font-black text-[var(--echo-paper)]">
              已确认 WorldInfo
            </h2>
            <p className="mt-3 max-h-[52vh] overflow-auto whitespace-pre-wrap font-mono text-sm leading-7 text-[var(--echo-muted)]">
              {formatWorldInfoForDossier(project.worldEntries)}
            </p>
            <Button type="button" className="mt-5 w-full" onClick={() => void handleNextStep()}>
              <WandSparkles aria-hidden="true" size={16} />
              进入开场白
            </Button>
          </aside>
        </section>
      </div>
    </main>
  );
}

import { Bug, GitMerge, Lightbulb, Plus, Trash2, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  removeWorldEntry,
  syncWorldInfoToDossier,
  upsertWorldEntry,
} from "@/features/world/worldStore";
import {
  buildWorldAssociationRequest,
  buildWorldDeepenRequest,
  extractCurrentWorldInfo,
  formatWorldEntriesJson,
} from "@/prompts/worldPrompts";
import { EmptyState } from "@/shared/components/EmptyState";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";

export function StepWorld() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [pendingEntries, setPendingEntries] = useState<WorldEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRequest, setUserRequest] = useState("");
  const [entryCount, setEntryCount] = useState(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const isGeneratingRef = useRef(false);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const generationKey = project ? `world:${project.id}:entries` : "world:pending";
  const generationTask = useGenerationStore((state) => state.getTask(generationKey));
  const generationTasks = useGenerationStore((state) => state.tasks);
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
        let nextProject = resolvedProject ?? null;
        if (nextProject) {
          const savedEntries = nextProject.worldEntries.filter((entry) => entry.enabled);
          if (savedEntries.length !== nextProject.worldEntries.length) {
            const updatedProject = await projectService.updateProject(nextProject.id, {
              worldEntries: savedEntries,
            });
            nextProject = updatedProject ?? { ...nextProject, worldEntries: savedEntries };
          }
          hydrateFromProject(nextProject);
        }
        setPendingEntries([]);
        setProject(nextProject);
        setIsLoading(false);
      }
    }

    void loadProject();
    return () => {
      ignored = true;
    };
  }, [hydrateFromProject, projectId]);

  const currentWorldInfo = useMemo(() => {
    return project ? extractCurrentWorldInfo(project) : "尚未明确";
  }, [project]);

  const debugWorldEntriesJson = useMemo(() => {
    return formatWorldEntriesJson(project?.worldEntries ?? []);
  }, [project]);

  const visibleWorldEntries = useMemo(() => {
    return [...pendingEntries, ...(project?.worldEntries ?? [])];
  }, [pendingEntries, project?.worldEntries]);

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
    if (isGeneratingRef.current || generationTask.status === "running" || generationTask.status === "pending") {
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
    isGeneratingRef.current = true;
    setRunning(generationKey, controller);

    try {
      const result = await generateWorldEntries({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        characterInfo: project.characterProfile?.yaml ?? "尚未生成",
        currentWorldInfo,
        existingWorldEntries: project.worldEntries,
        userRequest: trimmedRequest,
        entryCount,
        signal: controller.signal,
      });
      const candidates = createWorldEntryCandidates(project.id, result.data);
      setPendingEntries((entries) => [...candidates, ...entries]);
      setSucceeded(generationKey, result.taskId);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "世界书生成失败。";
      setErrorMessage(message);
      setFailed(generationKey, message);
    } finally {
      isGeneratingRef.current = false;
    }
  }

  async function handleRefineEntry(entry: WorldEntry, mode: "deepen" | "associate") {
    if (!project) {
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    const actionKey = `world:${project.id}:${mode}:${entry.id}`;
    const controller = new AbortController();
    setErrorMessage(null);
    setRunning(actionKey, controller);

    try {
      const result = await generateWorldEntries({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        characterInfo: project.characterProfile?.yaml ?? "尚未生成",
        currentWorldInfo,
        existingWorldEntries: project.worldEntries,
        userRequest:
          mode === "deepen"
            ? buildWorldDeepenRequest(entry)
            : buildWorldAssociationRequest(entry),
        entryCount: 1,
        signal: controller.signal,
      });
      if (result.data.length !== 1) {
        throw new Error(`模型返回了 ${result.data.length} 条 WorldInfo，但这次操作必须只返回 1 条。请重试。`);
      }

      const [candidate] = createWorldEntryCandidates(project.id, result.data);
      if (!candidate) {
        throw new Error("没有生成可用的 WorldInfo 条目。");
      }

      const nextProject =
        mode === "deepen"
          ? entry.enabled
            ? syncWorldInfoToDossier(
                upsertWorldEntry(project, {
                  ...entry,
                  title: candidate.title,
                  content: candidate.content,
                  keys: candidate.keys,
                  constant: candidate.constant,
                  position: candidate.position,
                  depth: candidate.depth,
                  insertionOrder: candidate.insertionOrder,
                }),
                result.taskId,
              )
            : null
          : {
              ...project,
              worldEntries: entry.enabled ? [candidate, ...project.worldEntries] : project.worldEntries,
            };

      if (mode === "deepen" && !entry.enabled) {
        setPendingEntries((entries) =>
          entries.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  title: candidate.title,
                  content: candidate.content,
                  keys: candidate.keys,
                  constant: candidate.constant,
                  position: candidate.position,
                  depth: candidate.depth,
                  insertionOrder: candidate.insertionOrder,
                }
              : item,
          ),
        );
      } else if (mode === "associate" && !entry.enabled) {
        setPendingEntries((entries) => [candidate, ...entries]);
      } else {
        if (!nextProject) {
          throw new Error("没有可保存的 WorldInfo 条目。");
        }
        await persistProject(
          nextProject,
          mode === "deepen" ? `深挖 WorldInfo：${entry.title}` : `联想 WorldInfo：${entry.title}`,
          [result.taskId],
        );
      }
      setSucceeded(actionKey, result.taskId);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "世界书生成失败。";
      setErrorMessage(message);
      setFailed(actionKey, message);
    }
  }

  async function handleEditEntry(entry: WorldEntry, patch: Partial<WorldEntry>) {
    if (!project) {
      return;
    }

    if (!entry.enabled) {
      setPendingEntries((entries) =>
        entries.map((item) => (item.id === entry.id ? { ...item, ...patch } : item)),
      );
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

    if (!entry.enabled) {
      const confirmedEntry = { ...entry, enabled: true };
      const nextProject = syncWorldInfoToDossier({
        ...project,
        worldEntries: [confirmedEntry, ...project.worldEntries],
      });
      const updatedProject = await persistProject(nextProject, `确认 WorldInfo：${entry.title}`);
      if (updatedProject) {
        setPendingEntries((entries) => entries.filter((item) => item.id !== entry.id));
      }
      return;
    }

    await persistProject(confirmWorldEntry(project, entry.id), `确认 WorldInfo：${entry.title}`);
  }

  async function handleDiscardEntry(entry: WorldEntry) {
    if (!project) {
      return;
    }

    if (!entry.enabled) {
      setPendingEntries((entries) => entries.filter((item) => item.id !== entry.id));
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
            每次按你选择的条数生成，最多三条。只有你确认过的 WorldInfo 会进入后续上下文；被舍弃的条目不会再参与生成。
          </p>
        </section>

        <section className="grid gap-6">
          <div className="grid gap-6">
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
                  useAnimalLoadingButton
                />
              </div>
            </div>

            <div className="grid gap-4">
              {visibleWorldEntries.map((entry) => (
                (() => {
                  const deepenKey = `world:${project.id}:deepen:${entry.id}`;
                  const associationKey = `world:${project.id}:associate:${entry.id}`;
                  const deepenTask = generationTasks[deepenKey];
                  const associationTask = generationTasks[associationKey];
                  const isDeepening = deepenTask?.status === "running" || deepenTask?.status === "pending";
                  const isAssociating =
                    associationTask?.status === "running" || associationTask?.status === "pending";
                  return (
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
                    value={entry.keys.join("、")}
                    onChange={(event) =>
                      void handleEditEntry(entry, {
                        keys: event.target.value
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
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={isDeepening}
                      disabled={isAssociating}
                      onClick={() => void handleRefineEntry(entry, "deepen")}
                    >
                      <Lightbulb aria-hidden="true" size={15} />
                      {isDeepening ? "深挖中" : "深挖"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={isAssociating}
                      disabled={isDeepening}
                      onClick={() => void handleRefineEntry(entry, "associate")}
                    >
                      <GitMerge aria-hidden="true" size={15} />
                      {isAssociating ? "联想中" : "联想"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" danger onClick={() => void handleDiscardEntry(entry)}>
                      <Trash2 aria-hidden="true" size={15} />
                      舍弃
                    </Button>
                  </div>
                </article>
                  );
                })()
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsDebugOpen(true)}>
              <Bug aria-hidden="true" size={16} />
              调试
            </Button>
            <Button type="button" onClick={() => void handleNextStep()}>
              <WandSparkles aria-hidden="true" size={16} />
              进入开场白
            </Button>
          </div>
        </section>
      </div>
      {isDebugOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(70,58,42,0.42)] p-4">
          <section className="w-full max-w-5xl border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-5 shadow-[0_8px_24px_rgba(61,52,40,0.18)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-black text-[var(--echo-paper)]">
                  世界书 JSON 调试
                </p>
                <p className="mt-1 font-mono text-xs text-[var(--echo-muted)]">
                  当前项目内保存的全部世界书条目。
                </p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => setIsDebugOpen(false)}>
                <X aria-hidden="true" size={18} />
                <span className="sr-only">关闭</span>
              </Button>
            </div>
            <textarea
              readOnly
              value={debugWorldEntriesJson}
              className="mt-4 h-[62vh] w-full resize-none border-2 border-[var(--animal-border-light)] bg-[rgba(255,255,255,0.5)] p-4 font-mono text-xs leading-6 text-[var(--echo-text)] outline-none"
            />
          </section>
        </div>
      ) : null}
    </main>
  );
}

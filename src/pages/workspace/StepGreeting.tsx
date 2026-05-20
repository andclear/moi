import { CheckCircle2, MessagesSquare, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type { GreetingVariant, Project } from "@/db/types";
import { historyService } from "@/db/services/historyService";
import { projectService } from "@/db/services/projectService";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { useFlowStore } from "@/features/flow/flowStore";
import {
  adoptGreetingVariant,
  createGreetingCandidates,
  discardGreetingVariant,
  getAdoptedGreetingVariants,
  greetingPersonTypes,
  isGreetingAdopted,
  pruneUnadoptedGreetingVariants,
  setGreetingSortOrder,
  updateGreetingVariant,
  type GreetingPersonType,
} from "@/features/greeting/greetingStore";
import { useGenerationStore } from "@/features/generation/generationStore";
import { generateGreetingVariants } from "@/features/llm/llmClient";
import { useSettingsStore } from "@/features/settings/settingsStore";
import { getConfirmedWorldEntries } from "@/features/world/worldStore";
import { EmptyState } from "@/shared/components/EmptyState";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

function sortGreetingVariants(variants: GreetingVariant[]) {
  const adopted = variants
    .filter(isGreetingAdopted)
    .sort((left, right) => (left.sortOrder ?? 999) - (right.sortOrder ?? 999));
  const drafts = variants
    .filter((variant) => !isGreetingAdopted(variant))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return [...adopted, ...drafts];
}

export function StepGreeting() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wordCount, setWordCount] = useState(800);
  const [personType, setPersonType] = useState<GreetingPersonType>("第二人称");
  const [userRequest, setUserRequest] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const generationKey = project ? `greeting:${project.id}` : "greeting:pending";
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

  const visibleVariants = useMemo(
    () => sortGreetingVariants(project?.greetingVariants ?? []),
    [project?.greetingVariants],
  );
  const adoptedVariants = useMemo(
    () => (project ? getAdoptedGreetingVariants(project) : []),
    [project],
  );

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

  async function handleGenerateGreeting() {
    if (!project) {
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    const controller = new AbortController();
    const sourceProject = pruneUnadoptedGreetingVariants(project);
    setErrorMessage(null);
    setRunning(generationKey, controller);

    try {
      const result = await generateGreetingVariants({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        characterInfoYaml: project.characterProfile?.yaml,
        confirmedEntries: getConfirmedWorldEntries(project),
        wordCount,
        personType,
        userRequest,
        signal: controller.signal,
      });
      const candidates = createGreetingCandidates(project.id, result.data);
      const nextProject = {
        ...sourceProject,
        greetingVariants: [...sourceProject.greetingVariants, ...candidates],
      };

      await persistProject(nextProject, "生成开场白候选", [result.taskId]);
      setSucceeded(generationKey, result.taskId);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "开场白生成失败。";
      setErrorMessage(message);
      setFailed(generationKey, message);
    }
  }

  async function handleEditVariant(variant: GreetingVariant, patch: Partial<GreetingVariant>) {
    if (!project) {
      return;
    }

    await persistProject(updateGreetingVariant(project, { ...variant, ...patch }));
  }

  async function handleAdoptVariant(variant: GreetingVariant) {
    if (!project) {
      return;
    }

    await persistProject(adoptGreetingVariant(project, variant.id), `采用开场白：${variant.title}`);
  }

  async function handleDiscardVariant(variant: GreetingVariant) {
    if (!project || isGreetingAdopted(variant)) {
      return;
    }

    await persistProject(discardGreetingVariant(project, variant.id));
  }

  async function handleSortOrderChange(variant: GreetingVariant, nextOrder: number) {
    if (!project || !Number.isFinite(nextOrder)) {
      return;
    }

    await persistProject(setGreetingSortOrder(project, variant.id, nextOrder));
  }

  async function handleNextStep() {
    if (!project || adoptedVariants.length === 0) {
      return;
    }

    const updatedProject = await persistProject(
      {
        ...project,
        currentStep: "trial",
      },
      "完成开场白阶段",
    );

    if (updatedProject) {
      markStepCompleted("greeting");
      navigate(`/workspace/${updatedProject.id}/trial`);
    }
  }

  if (isLoading) {
    return <div className="p-6 font-mono text-sm text-[var(--echo-muted)]">正在整理初次相遇的场景……</div>;
  }

  if (!project) {
    return (
      <div className="p-6">
        <EmptyState title="这里还没有 TA" description="先写下岛民便笺，才能整理第一句话。" />
      </div>
    );
  }

  return (
    <main className="echo-workspace-page">
      <div className="echo-workspace-inner space-y-6">
        <section className="echo-section-card">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            GREETING
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
            让 TA 从场景里开口
          </h1>
          <p className="mt-3 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            写下开场情景、冲突点和想要的叙事视角。采用后的开场白会进入最终角色卡，排序第一的是主开场白。
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <aside className="echo-side-panel h-fit space-y-5">
            <div className="flex items-center gap-3">
              <SlidersHorizontal aria-hidden="true" size={22} className="text-[var(--echo-muted)]" />
              <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">生成条件</h2>
            </div>

            <label className="block font-mono text-xs font-bold text-[var(--echo-muted)]">
              生成要求
              <textarea
                value={userRequest}
                onChange={(event) => setUserRequest(event.target.value)}
                placeholder={"描述开场的情景、冲突点等。\n\n如果需要一次生成多个开场白，可以这样写：\n1. 雨夜里 TA 带着一封不能公开的信来找 {{user}}\n2. 庆典后台，TA 发现 {{user}} 拿错了关键道具"}
                className="mt-2 min-h-72 w-full resize-y rounded-[28px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-5 py-4 text-base leading-7 text-[var(--echo-text)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none transition focus:border-[var(--animal-focus-yellow)] focus:shadow-[0_3px_0_0_var(--animal-focus-yellow-dark)]"
              />
            </label>

            <label className="block font-mono text-xs font-bold text-[var(--echo-muted)]">
              字数要求
              <input
                type="number"
                min={120}
                max={3000}
                step={50}
                value={wordCount}
                onChange={(event) => setWordCount(Number(event.target.value))}
                className="mt-2 h-14 w-full rounded-[22px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-5 text-base text-[var(--echo-text)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none transition focus:border-[var(--animal-focus-yellow)] focus:shadow-[0_3px_0_0_var(--animal-focus-yellow-dark)]"
              />
            </label>

            <label className="block font-mono text-xs font-bold text-[var(--echo-muted)]">
              叙述人称模式
              <select
                value={personType}
                onChange={(event) => setPersonType(event.target.value as GreetingPersonType)}
                className="mt-2 h-14 w-full rounded-[22px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-5 text-base text-[var(--echo-text)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none transition focus:border-[var(--animal-focus-yellow)] focus:shadow-[0_3px_0_0_var(--animal-focus-yellow-dark)]"
              >
                {greetingPersonTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <GenerationButton
              idleLabel="生成开场白"
              runningLabel="正在整理第一句话"
              retryLabel="重新生成"
              status={generationTask.status}
              errorMessage={errorMessage ?? generationTask.errorMessage}
              onGenerate={handleGenerateGreeting}
              onCancel={() => cancel(generationKey)}
              useAnimalLoadingButton
              className="w-full"
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={adoptedVariants.length === 0}
              onClick={() => void handleNextStep()}
            >
              <CheckCircle2 aria-hidden="true" size={16} />
              进入相处测试
            </Button>
          </aside>

          <div className="min-w-0 space-y-5">
            {visibleVariants.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="这里还没有第一句话"
                description="写下开场要求后，可以一次生成一条或多条开场白候选。"
              />
            ) : (
              visibleVariants.map((variant) => {
                const adopted = isGreetingAdopted(variant);
                const isPrimary = adopted && variant.sortOrder === 1;
                return (
                  <article
                    key={variant.id}
                    className={cn(
                      "echo-text-card border-2 transition",
                      adopted
                        ? "border-[var(--animal-primary)] bg-[rgba(230,249,246,0.72)] shadow-[0_6px_0_0_rgba(17,168,155,0.24)]"
                        : "border-[var(--echo-line)]",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[220px] flex-1 space-y-2">
                        <input
                          value={variant.title}
                          onChange={(event) =>
                            void handleEditVariant(variant, { title: event.target.value })
                          }
                          className="min-h-14 w-full rounded-[22px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-5 font-display text-2xl font-black leading-tight text-[var(--echo-paper)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none transition focus:border-[var(--animal-focus-yellow)] focus:shadow-[0_3px_0_0_var(--animal-focus-yellow-dark)]"
                        />
                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
                          {isPrimary ? (
                            <span className="rounded-full border-2 border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] px-3 py-1 text-[var(--animal-primary-active)]">
                              主开场白
                            </span>
                          ) : null}
                          {adopted ? (
                            <span className="rounded-full border-2 border-[var(--animal-primary)] bg-white/70 px-3 py-1 text-[var(--animal-primary-active)]">
                              已采用
                            </span>
                          ) : (
                            <span className="rounded-full border-2 border-[var(--animal-border-light)] bg-white/70 px-3 py-1 text-[var(--animal-text-muted)]">
                              待选择
                            </span>
                          )}
                        </div>
                      </div>

                      {adopted ? (
                        <label className="font-mono text-xs font-bold text-[var(--echo-muted)]">
                          排序
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, adoptedVariants.length)}
                            value={variant.sortOrder ?? 1}
                            onChange={(event) =>
                              void handleSortOrderChange(variant, Number(event.target.value))
                            }
                            className="mt-2 h-12 w-24 rounded-[18px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 text-center text-base font-black text-[var(--echo-paper)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none focus:border-[var(--animal-focus-yellow)]"
                          />
                        </label>
                      ) : null}
                    </div>

                    <textarea
                      value={variant.content}
                      onChange={(event) =>
                        void handleEditVariant(variant, { content: event.target.value })
                      }
                      className="mt-4 min-h-[32rem] w-full resize-y rounded-[28px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-5 py-4 font-mono text-base leading-8 text-[var(--echo-text)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none transition focus:border-[var(--animal-focus-yellow)] focus:shadow-[0_3px_0_0_var(--animal-focus-yellow-dark)]"
                    />

                    <div className="mt-4 flex flex-wrap gap-3">
                      {adopted ? null : (
                        <Button type="button" onClick={() => void handleAdoptVariant(variant)}>
                          <CheckCircle2 aria-hidden="true" size={16} />
                          采用
                        </Button>
                      )}
                      {!adopted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          danger
                          onClick={() => void handleDiscardVariant(variant)}
                        >
                          <Trash2 aria-hidden="true" size={16} />
                          丢弃
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

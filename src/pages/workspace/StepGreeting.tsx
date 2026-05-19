import { CheckCircle2, MessagesSquare, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type { GreetingVariant, Project } from "@/db/types";
import { historyService } from "@/db/services/historyService";
import { projectService } from "@/db/services/projectService";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { useFlowStore } from "@/features/flow/flowStore";
import {
  createGreetingCandidates,
  greetingPersonTypes,
  greetingRoleLabels,
  selectGreetingVariant,
  updateGreetingVariant,
  type GreetingPersonType,
  type GreetingRoleTone,
} from "@/features/greeting/greetingStore";
import { useGenerationStore } from "@/features/generation/generationStore";
import { generateGreetingVariants } from "@/features/llm/llmClient";
import { useSettingsStore } from "@/features/settings/settingsStore";
import { getConfirmedWorldEntries } from "@/features/world/worldStore";
import { EmptyState } from "@/shared/components/EmptyState";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";

const roleOrder = Object.keys(greetingRoleLabels) as GreetingRoleTone[];

export function StepGreeting() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<GreetingRoleTone>("stranger");
  const [wordCount, setWordCount] = useState(450);
  const [personType, setPersonType] = useState<GreetingPersonType>("第二人称");
  const [heatLevel, setHeatLevel] = useState(3);
  const [mustInclude, setMustInclude] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const generationKey = project ? `greeting:${project.id}:${role}` : "greeting:pending";
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

  const currentRoleVariants = useMemo(() => {
    if (!project) {
      return [];
    }
    return project.greetingVariants.filter((variant) => variant.userRole === greetingRoleLabels[role]);
  }, [project, role]);

  const selectedVariant = project?.greetingVariants.find((variant) => variant.selected);

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
    setErrorMessage(null);
    setRunning(generationKey, controller);

    try {
      const result = await generateGreetingVariants({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        confirmedEntries: getConfirmedWorldEntries(project),
        userRole: role,
        wordCount,
        personType,
        mustInclude,
        heatLevel,
        signal: controller.signal,
      });
      const candidates = createGreetingCandidates(project.id, role, result.data);
      const nextProject = {
        ...project,
        greetingVariants: [...candidates, ...project.greetingVariants],
      };

      await persistProject(nextProject, `生成${greetingRoleLabels[role]}开场白`, [result.taskId]);
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

  async function handleSelectVariant(variant: GreetingVariant) {
    if (!project) {
      return;
    }

    await persistProject(selectGreetingVariant(project, variant.id), `锁定开场白：${variant.title}`);
  }

  async function handleNextStep() {
    if (!project) {
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
        <EmptyState title="这里没有传来回音" description="先找到 TA，才能听见第一句话。" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-9rem)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="border-2 border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-5 shadow-[0_4px_10px_rgba(107,92,67,0.28)]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            初次接触
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
            让 TA 从场景里开口
          </h1>
          <p className="mt-3 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            选择身份、字数和人称后生成候选。锁定的那一条会写入 TA 的回音，并进入终审上下文。
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4">
            <SlidersHorizontal aria-hidden="true" size={22} className="text-[var(--echo-muted)]" />
            <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">生成条件</h2>

            <div className="grid grid-cols-2 gap-2">
              {roleOrder.map((roleId) => (
                <Button
                  key={roleId}
                  type="button"
                  variant={role === roleId ? "primary" : "secondary"}
                  onClick={() => setRole(roleId)}
                >
                  {greetingRoleLabels[roleId]}
                </Button>
              ))}
            </div>

            <label className="block font-mono text-xs text-[var(--echo-muted)]">
              字数要求
              <input
                type="number"
                min={120}
                max={1200}
                step={50}
                value={wordCount}
                onChange={(event) => setWordCount(Number(event.target.value))}
                className="mt-2 w-full border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 py-2 text-[var(--echo-text)] outline-none"
              />
            </label>

            <label className="block font-mono text-xs text-[var(--echo-muted)]">
              人称模式
              <select
                value={personType}
                onChange={(event) => setPersonType(event.target.value as GreetingPersonType)}
                className="mt-2 w-full border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 py-2 text-[var(--echo-text)] outline-none"
              >
                {greetingPersonTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block font-mono text-xs text-[var(--echo-muted)]">
              语气热烈程度：{heatLevel}
              <input
                type="range"
                min={1}
                max={5}
                value={heatLevel}
                onChange={(event) => setHeatLevel(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>

            <label className="block font-mono text-xs text-[var(--echo-muted)]">
              必须包含的要素
              <textarea
                value={mustInclude}
                onChange={(event) => setMustInclude(event.target.value)}
                placeholder="比如：雨夜、未寄出的信、旧城区的钟声。"
                className="mt-2 min-h-24 w-full resize-y border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3 text-[var(--echo-text)] outline-none"
              />
            </label>

            <GenerationButton
              idleLabel="生成开场白"
              runningLabel="正在听见第一句话"
              retryLabel="重新生成"
              status={generationTask.status}
              errorMessage={errorMessage ?? generationTask.errorMessage}
              onGenerate={handleGenerateGreeting}
              onCancel={() => cancel(generationKey)}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!selectedVariant}
              onClick={() => void handleNextStep()}
            >
              <CheckCircle2 aria-hidden="true" size={16} />
              进入终审
            </Button>
          </aside>

          <div className="space-y-4">
            {currentRoleVariants.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="这里还没有第一句话"
                description="先选择一种相遇身份，让模型给出两到三个开场白候选。"
              />
            ) : (
              currentRoleVariants.map((variant) => (
                <article
                  key={variant.id}
                  className="border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <input
                      value={variant.title}
                      onChange={(event) =>
                        void handleEditVariant(variant, { title: event.target.value })
                      }
                      className="min-w-0 flex-1 bg-transparent font-display text-2xl font-black text-[var(--echo-paper)] outline-none"
                    />
                    <span className="border border-[var(--echo-line)] px-2 py-1 font-mono text-[0.68rem] text-[var(--echo-muted)]">
                      {variant.selected ? "已锁定" : variant.userRole}
                    </span>
                  </div>
                  <textarea
                    value={variant.content}
                    onChange={(event) =>
                      void handleEditVariant(variant, { content: event.target.value })
                    }
                    className="mt-4 min-h-72 w-full resize-y border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3 font-mono text-sm leading-7 text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                  />
                  <Button
                    type="button"
                    className="mt-4"
                    disabled={variant.selected}
                    onClick={() => void handleSelectVariant(variant)}
                  >
                    <CheckCircle2 aria-hidden="true" size={16} />
                    锁定这一段
                  </Button>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

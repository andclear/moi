import { BookOpenText, FileQuestion, LockKeyhole, Scissors, UserRoundSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type {
  DossierBlockMeta,
  ProfileChoice,
  ProfileSession,
  ProfileStageId,
  Project,
} from "@/db/types";
import { projectService } from "@/db/services/projectService";
import { historyService } from "@/db/services/historyService";
import { useDossierStore } from "@/features/dossier/dossierStore";
import {
  buildDossierBlockMeta,
  parseDossierSections,
} from "@/features/dossier/dossierSections";
import { useFlowStore } from "@/features/flow/flowStore";
import { useGenerationStore } from "@/features/generation/generationStore";
import { generateProfileStage } from "@/features/llm/llmClient";
import {
  buildPreviousChoiceSummary,
  createEmptyProfileSession,
  getNextProfileStage,
  normalizeProfileChoices,
  profileStageDescriptions,
  profileStageLabels,
  profileStageOrder,
} from "@/features/profile/profileSession";
import { useSettingsStore } from "@/features/settings/settingsStore";
import { ChoiceCard } from "@/shared/components/ChoiceCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";
import { nowIso } from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";

const stageIcons = {
  silhouette: UserRoundSearch,
  exclusion: Scissors,
  fragment: BookOpenText,
  diary: LockKeyhole,
} satisfies Record<ProfileStageId, typeof UserRoundSearch>;

const stageTargetSections = {
  silhouette: "核心人格",
  exclusion: "核心人格",
  fragment: "背景故事",
  diary: "核心矛盾",
} satisfies Record<ProfileStageId, string>;

function appendToDossierSection(markdown: string, section: string, addition: string) {
  const blocks = parseDossierSections(markdown);
  const blockBySection = new Map(blocks.map((block) => [block.section, block]));

  return blocks
    .map((block) => {
      if (block.section !== section) {
        return `## ${block.section}\n\n${block.content || "尚未听见"}`;
      }

      const currentContent = block.content === "尚未听见" ? "" : block.content;
      const nextContent = [currentContent, addition.trim()].filter(Boolean).join("\n\n");
      return `## ${block.section}\n\n${nextContent || "尚未听见"}`;
    })
    .concat(blockBySection.has(section) ? [] : [`## ${section}\n\n${addition.trim()}`])
    .join("\n\n");
}

function getStageCompletionIndex(session: ProfileSession) {
  return profileStageOrder.reduce((index, stageId, currentIndex) => {
    return session.stages[stageId].selectedChoiceId ? currentIndex : index;
  }, -1);
}

export function StepProfile() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const generationKey = project?.profileSession
    ? `profile:${project.id}:${project.profileSession.currentStageId}`
    : "profile:pending";
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
      if (!resolvedProject) {
        if (!ignored) {
          setProject(null);
          setIsLoading(false);
        }
        return;
      }

      const profileSession = resolvedProject.profileSession ?? createEmptyProfileSession();
      const hydratedProject =
        resolvedProject.profileSession === profileSession
          ? resolvedProject
          : await projectService.updateProfileSession(resolvedProject.id, profileSession);

      if (!ignored && hydratedProject) {
        hydrateFromProject(hydratedProject);
        setProject(hydratedProject);
        setIsLoading(false);
      }
    }

    void loadProject();
    return () => {
      ignored = true;
    };
  }, [hydrateFromProject, projectId]);

  const session = project?.profileSession ?? createEmptyProfileSession();
  const currentStageId = session.currentStageId;
  const currentStage = session.stages[currentStageId];
  const completedIndex = getStageCompletionIndex(session);

  const previousChoiceSummary = useMemo(() => buildPreviousChoiceSummary(session), [session]);

  async function persistProject(patch: Partial<Omit<Project, "id" | "createdAt">>) {
    if (!project) {
      return null;
    }
    const updatedProject = await projectService.updateProject(project.id, patch);
    if (updatedProject) {
      hydrateFromProject(updatedProject);
      setProject(updatedProject);
    }
    return updatedProject;
  }

  async function handleGenerateStage() {
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
      const result = await generateProfileStage({
        projectId: project.id,
        stageId: currentStageId,
        dossierMarkdown: project.dossier.markdown,
        previousChoices: previousChoiceSummary,
        signal: controller.signal,
      });
      const nextSession: ProfileSession = {
        ...session,
        stages: {
          ...session.stages,
          [currentStageId]: {
            ...currentStage,
            choices: normalizeProfileChoices(result.data.choices),
            generationId: result.taskId,
          },
        },
      };
      await persistProject({ profileSession: nextSession });
      setSucceeded(generationKey, result.taskId);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "侧写生成失败。";
      setErrorMessage(message);
      setFailed(generationKey, message);
    }
  }

  async function handleSelectChoice(choice: ProfileChoice) {
    if (!project) {
      return;
    }

    const now = nowIso();
    const targetSection = stageTargetSections[currentStageId];
    const nextMarkdown = appendToDossierSection(
      project.dossier.markdown,
      targetSection,
      choice.dossierAddition,
    );
    const nextBlocks: DossierBlockMeta[] = buildDossierBlockMeta(
      nextMarkdown,
      project.dossier.blocks,
      "user_confirmed",
      now,
      currentStage.generationId,
    );

    const nextStageId = getNextProfileStage(currentStageId);
    const nextSession: ProfileSession = {
      currentStageId: nextStageId ?? currentStageId,
      stages: {
        ...session.stages,
        [currentStageId]: {
          ...currentStage,
          selectedChoiceId: choice.id,
          completedAt: now,
        },
      },
    };

    const updatedProject = await persistProject({
      currentStep: nextStageId ? "profile" : "world",
      dossier: {
        markdown: nextMarkdown,
        blocks: nextBlocks,
        updatedAt: now,
      },
      profileSession: nextSession,
    });

    await historyService.createSnapshot(
      project.id,
      `${profileStageLabels[currentStageId]}：${choice.title}`,
      currentStage.generationId ? [currentStage.generationId] : [],
    );

    if (!nextStageId && updatedProject) {
      markStepCompleted("profile");
      navigate(`/workspace/${updatedProject.id}/world`);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 font-mono text-sm leading-6 text-[var(--echo-muted)]">
        正在整理 TA 的回音……
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <h1 className="mb-6 font-display text-4xl font-black text-[var(--echo-paper)]">
          辨认轮廓
        </h1>
        <EmptyState
          title="还没有被寻回的 TA"
          description="先写下一张寻人启事，系统才知道该从哪一道回音开始辨认。"
          action={
            <Button type="button" onClick={() => navigate("/workspace/current/post")}>
              返回寻人启事
            </Button>
          }
        />
      </div>
    );
  }

  const StageIcon = stageIcons[currentStageId];

  return (
    <main className="min-h-[calc(100vh-9rem)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="border-2 border-[var(--echo-line)] bg-[rgba(18,33,42,0.82)] p-5 shadow-[8px_8px_0_var(--echo-shadow)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
                辨认轮廓
              </p>
              <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
                {profileStageLabels[currentStageId]}
              </h1>
              <p className="mt-3 max-w-2xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
                {profileStageDescriptions[currentStageId]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {profileStageOrder.map((stageId, index) => {
                const Icon = stageIcons[stageId];
                const isCurrent = stageId === currentStageId;
                const isDone = index <= completedIndex;
                return (
                  <span
                    key={stageId}
                    className={cn(
                      "inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold",
                      isCurrent
                        ? "border-[var(--echo-paper)] bg-[var(--echo-paper)] text-[var(--echo-ink)]"
                        : isDone
                          ? "border-[var(--echo-line)] bg-[rgba(244,231,203,0.12)] text-[var(--echo-paper)]"
                          : "border-[var(--echo-line)] text-[var(--echo-muted)]",
                    )}
                  >
                    <Icon aria-hidden="true" size={15} />
                    {profileStageLabels[stageId]}
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5">
            {currentStage.choices.length === 0 ? (
              <EmptyState
                icon={StageIcon}
                title="这里还没有显影"
                description="让模型先给出三种可能，再从里面认出最接近 TA 的那一个。"
                action={
                  <GenerationButton
                    idleLabel="寻找这一段回音"
                    runningLabel="正在显影"
                    retryLabel="重新寻找"
                    status={generationTask.status}
                    errorMessage={errorMessage ?? generationTask.errorMessage}
                    onGenerate={handleGenerateStage}
                    onCancel={() => cancel(generationKey)}
                  />
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {currentStage.choices.map((choice) => (
                  <ChoiceCard
                    key={choice.id}
                    title={choice.title}
                    content={choice.content}
                    detail={choice.detail}
                    selected={choice.id === currentStage.selectedChoiceId}
                    disabled={Boolean(currentStage.selectedChoiceId)}
                    onSelect={() => void handleSelectChoice(choice)}
                  />
                ))}
              </div>
            )}
            {currentStage.choices.length > 0 && !currentStage.selectedChoiceId && (
              <div className="flex flex-wrap items-center gap-3">
                <GenerationButton
                  idleLabel="换一组三种可能"
                  runningLabel="正在重新显影"
                  retryLabel="重新寻找"
                  variant="secondary"
                  status={generationTask.status}
                  errorMessage={errorMessage ?? generationTask.errorMessage}
                  onGenerate={handleGenerateStage}
                  onCancel={() => cancel(generationKey)}
                />
                <p className="font-mono text-xs leading-5 text-[var(--echo-muted)]">
                  选择后会写入 TA 的回音，逐步让核心人格更清楚。
                </p>
              </div>
            )}
          </div>

          <aside className="border-2 border-[var(--echo-line)] bg-[rgba(2,16,24,0.42)] p-4">
            <FileQuestion aria-hidden="true" size={22} className="text-[var(--echo-muted)]" />
            <h2 className="mt-3 font-display text-2xl font-black text-[var(--echo-paper)]">
              已确认的回音
            </h2>
            <p className="mt-3 whitespace-pre-wrap font-mono text-xs leading-6 text-[var(--echo-muted)]">
              {previousChoiceSummary || "尚未确认。"}
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}

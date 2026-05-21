import { BookOpenText, LockKeyhole, Scissors, UserRoundSearch } from "lucide-react";
import { Select } from "animal-island-ui";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type {
  DossierBlockMeta,
  ProfileChoice,
  ProfileDiaryDraft,
  ProfileStageId,
  ProfileSession,
  Project,
} from "@/db/types";
import { historyService } from "@/db/services/historyService";
import { projectService } from "@/db/services/projectService";
import {
  buildDossierBlockMeta,
  parseDossierSections,
} from "@/features/dossier/dossierSections";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { generateAndSaveCharacterProfile } from "@/features/characterProfile/characterProfileService";
import { useFlowStore } from "@/features/flow/flowStore";
import { useGenerationStore } from "@/features/generation/generationStore";
import {
  generateProfileDossierUpdate,
  generateProfileStage,
} from "@/features/llm/llmClient";
import {
  buildPreviousChoiceSummary,
  createEmptyProfileSession,
  getNextProfileStage,
  getSelectedProfileChoice,
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
    const stage = session.stages[stageId];
    return stage.selectedChoiceId || stage.completedAt ? currentIndex : index;
  }, -1);
}

function buildSelectedContextSummary(session: ProfileSession) {
  return profileStageOrder
    .filter((stageId) => stageId !== "diary")
    .map((stageId) => {
      const choice = getSelectedProfileChoice(session, stageId);
      return choice ? `${profileStageLabels[stageId]}：${choice.title} - ${choice.content}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildCompletedDiaryText(draft: ProfileDiaryDraft, selections: Record<string, string>) {
  return draft.diaryText.replace(/\[\[(blank_\d+|[^\]]+)\]\]/g, (placeholder, key: string) => {
    const blank = draft.blanks.find((item) => item.key === key);
    const selectedOption = blank?.options.find((option) => option.key === selections[key]);
    return selectedOption?.label ?? placeholder;
  });
}

function areAllDiaryBlanksSelected(draft: ProfileDiaryDraft, selections: Record<string, string>) {
  return draft.blanks.every((blank) => Boolean(selections[blank.key]));
}

interface DiaryDecodePanelProps {
  draft: ProfileDiaryDraft;
  selections: Record<string, string>;
  disabled?: boolean;
  onChange: (blankKey: string, optionKey: string) => void;
}

function DiaryDecodePanel({
  draft,
  selections,
  disabled = false,
  onChange,
}: DiaryDecodePanelProps) {
  const [openedBlankKey, setOpenedBlankKey] = useState("");
  const parts = draft.diaryText.split(/(\[\[(?:blank_\d+|[^\]]+)\]\])/g);

  return (
    <article className="echo-text-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--animal-text-muted)]">
            日记破译
          </p>
          <h2 className="mt-2 font-display text-3xl font-black text-[var(--animal-text)]">
            {draft.title}
          </h2>
        </div>
        <span className="rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] px-4 py-2 text-sm font-black text-[var(--animal-text)]">
          选完 3 处遮挡后更新档案
        </span>
      </div>

      {draft.note && (
        <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-[var(--animal-text-muted)]">
          {draft.note}
        </p>
      )}

      <div className="mt-6 overflow-visible rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.42)] p-3 shadow-[0_3px_0_0_var(--animal-shadow-input)] sm:p-5">
        <div className="echo-long-text max-w-none overflow-visible text-[var(--animal-text-body)]">
          {parts.map((part, index) => {
            const match = /^\[\[(.+)\]\]$/.exec(part);
            if (!match) {
              return <span key={`${part}-${index}`}>{part}</span>;
            }

            const blankKey = match[1];
            const blank = draft.blanks.find((item) => item.key === blankKey);
            const selectedOption = blank?.options.find(
              (option) => option.key === selections[blankKey],
            );
            const isOpen = openedBlankKey === blankKey;

            return (
              <span
                key={blankKey}
                className="relative mx-1 inline-flex items-center align-baseline"
              >
                {blank && isOpen ? (
                  <button
                    type="button"
                    aria-label="关闭破译选项"
                    className="echo-mobile-sheet-backdrop"
                    onClick={() => setOpenedBlankKey("")}
                  />
                ) : null}
                <button
                  type="button"
                  disabled={disabled || !blank}
                  onClick={() => setOpenedBlankKey(isOpen ? "" : blankKey)}
                  className={cn(
                    "echo-diary-blank-trigger inline-flex min-h-9 items-center rounded-[var(--animal-radius-pill)] border-2 px-4 py-1 align-baseline text-sm font-black transition-all",
                    selectedOption
                      ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
                      : "border-[var(--animal-border)] bg-[var(--animal-bg-content)] text-[var(--animal-text-muted)] shadow-[0_3px_0_0_var(--animal-shadow-input)] hover:-translate-y-0.5 hover:border-[var(--animal-primary)]",
                  )}
                >
                  {selectedOption?.label ?? blank?.label ?? "点击破译"}
                </button>

                {blank && isOpen ? (
                  <span className="echo-diary-blank-popover absolute left-0 top-full z-30 mt-3 grid w-[min(78vw,22rem)] gap-3 rounded-[var(--animal-radius)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-4 text-left shadow-[0_10px_22px_rgba(61,52,40,0.18)]">
                    <span className="text-sm font-black leading-6 text-[var(--animal-text)]">
                      {blank.label}
                    </span>
                    <Select
                      options={blank.options.map((option) => ({
                        key: option.key,
                        label: option.label,
                      }))}
                      value={selections[blank.key] ?? ""}
                      onChange={(optionKey) => {
                        onChange(blank.key, optionKey);
                        setOpenedBlankKey("");
                      }}
                      placeholder="请选择"
                      disabled={disabled}
                    />
                    {selectedOption ? (
                      <span className="text-sm font-bold leading-6 text-[var(--animal-text-muted)]">
                        {selectedOption.meaning}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>
    </article>
  );
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
  const updateGenerationKey = project ? `profile:${project.id}:diary-update` : "profile:update:pending";
  const generationTask = useGenerationStore((state) => state.getTask(generationKey));
  const updateGenerationTask = useGenerationStore((state) => state.getTask(updateGenerationKey));
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
  const selectedContextSummary = useMemo(() => buildSelectedContextSummary(session), [session]);
  const diarySelections = currentStage.diarySelections ?? {};
  const completedDiaryText =
    currentStage.diaryDraft && areAllDiaryBlanksSelected(currentStage.diaryDraft, diarySelections)
      ? buildCompletedDiaryText(currentStage.diaryDraft, diarySelections)
      : "";

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

  function ensureModelAvailable() {
    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return false;
    }
    return true;
  }

  async function handleGenerateStage() {
    if (!project || !ensureModelAvailable()) {
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
      const nextStageState =
        result.data.kind === "diary"
          ? {
              ...currentStage,
              choices: [],
              diaryDraft: result.data.draft,
              diarySelections: {},
              completedDiaryText: undefined,
              generationId: result.taskId,
            }
          : {
              ...currentStage,
              choices: normalizeProfileChoices(result.data.choices),
              diaryDraft: undefined,
              diarySelections: undefined,
              completedDiaryText: undefined,
              generationId: result.taskId,
            };
      const nextSession: ProfileSession = {
        ...session,
        stages: {
          ...session.stages,
          [currentStageId]: nextStageState,
        },
      };
      await persistProject({ profileSession: nextSession });
      setSucceeded(generationKey, result.taskId);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "岛民资料生成失败。";
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

    await persistProject({
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
  }

  async function handleSelectDiaryBlank(blankKey: string, optionKey: string) {
    if (!project || !currentStage.diaryDraft) {
      return;
    }

    const nextSelections = {
      ...diarySelections,
      [blankKey]: optionKey,
    };
    const nextCompletedDiaryText = areAllDiaryBlanksSelected(
      currentStage.diaryDraft,
      nextSelections,
    )
      ? buildCompletedDiaryText(currentStage.diaryDraft, nextSelections)
      : undefined;
    const nextSession: ProfileSession = {
      ...session,
      stages: {
        ...session.stages,
        diary: {
          ...currentStage,
          diarySelections: nextSelections,
          completedDiaryText: nextCompletedDiaryText,
        },
      },
    };

    await persistProject({ profileSession: nextSession });
  }

  async function handleUpdateDossier() {
    if (!project || !currentStage.diaryDraft || !completedDiaryText || !ensureModelAvailable()) {
      return;
    }

    const controller = new AbortController();
    setErrorMessage(null);
    setRunning(updateGenerationKey, controller);

    try {
      const result = await generateProfileDossierUpdate({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        previousChoices: selectedContextSummary,
        completedDiaryText,
        signal: controller.signal,
      });
      const now = nowIso();
      const nextBlocks = buildDossierBlockMeta(
        result.data.dossierMarkdown,
        project.dossier.blocks,
        "ai_inferred",
        now,
        result.taskId,
      );
      const nextSession: ProfileSession = {
        currentStageId,
        stages: {
          ...session.stages,
          diary: {
            ...currentStage,
            completedDiaryText,
            completedAt: now,
            generationId: result.taskId,
          },
        },
      };
      const updatedProject = await persistProject({
        title: result.data.title || project.title,
        currentStep: "world",
        dossier: {
          markdown: result.data.dossierMarkdown,
          blocks: nextBlocks,
          updatedAt: now,
        },
        profileSession: nextSession,
      });

      await historyService.createSnapshot(project.id, "更新岛民档案", [result.taskId]);
      setSucceeded(updateGenerationKey, result.taskId);

      if (updatedProject) {
        void generateAndSaveCharacterProfile(updatedProject.id, result.data.dossierMarkdown);
        markStepCompleted("profile");
        navigate(`/workspace/${updatedProject.id}/world`);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "岛民档案更新失败。";
      setErrorMessage(message);
      setFailed(updateGenerationKey, message);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 font-mono text-sm leading-6 text-[var(--echo-muted)]">
        正在整理 TA 的档案……
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <h1 className="mb-6 font-display text-4xl font-black text-[var(--echo-paper)]">
          认识岛民
        </h1>
        <EmptyState
          title="还没有被寻回的 TA"
          description="先写下一张岛民便笺，系统才知道该从哪里开始靠近 TA。"
          action={
            <Button type="button" onClick={() => navigate("/workspace/current/post")}>
              返回岛民便笺
            </Button>
          }
        />
      </div>
    );
  }

  const StageIcon = stageIcons[currentStageId];
  const isDiaryStage = currentStageId === "diary";
  const activeTask = isDiaryStage && currentStage.diaryDraft ? updateGenerationTask : generationTask;

  return (
    <main className="echo-workspace-page">
      <div className="echo-workspace-inner">
        <section className="echo-section-card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
                认识岛民
              </p>
              <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
                {profileStageLabels[currentStageId]}
              </h1>
              <p className="mt-3 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
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
                        ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
                        : isDone
                          ? "border-[var(--echo-line)] bg-[var(--animal-bg-content)] text-[var(--echo-paper)]"
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

        <section className="mt-6 grid gap-5">
          {!isDiaryStage && currentStage.choices.length === 0 ? (
            <EmptyState
              icon={StageIcon}
              title="这里还没有新的选项"
              description={
                currentStageId === "exclusion"
                  ? "这一轮要选最不可能是 TA 的方向，排除掉它。"
                  : "让模型先给出三种可能，再从里面选出最接近 TA 的那一个。"
              }
              action={
                <GenerationButton
                  idleLabel={`生成${profileStageLabels[currentStageId]}`}
                  runningLabel="正在整理"
                  retryLabel="重新整理"
                  status={generationTask.status}
                  errorMessage={errorMessage ?? generationTask.errorMessage}
                  onGenerate={handleGenerateStage}
                  onCancel={() => cancel(generationKey)}
                  useAnimalLoadingButton
                />
              }
            />
          ) : null}

          {!isDiaryStage && currentStage.choices.length > 0 ? (
            <>
              <div
                className={cn(
                  "rounded-[var(--animal-radius)] border-2 p-4 text-sm font-black leading-7 shadow-[0_3px_0_0_var(--animal-shadow-input)]",
                  currentStageId === "exclusion"
                    ? "border-[var(--animal-error)] bg-[rgba(224,90,90,0.12)] text-[var(--animal-error-active)]"
                    : "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]",
                )}
              >
                {currentStageId === "exclusion" ? (
                  <span>
                    请注意：这一轮选一个
                    <strong>最不可能是 TA</strong>
                    的方向。
                  </span>
                ) : (
                  "请选择最像 TA、最能补充 TA 的那一项。"
                )}
              </div>
              <div className="grid gap-4">
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
            </>
          ) : null}

          {!isDiaryStage && currentStage.choices.length > 0 && !currentStage.selectedChoiceId ? (
            <div className="flex flex-wrap items-center gap-3">
              <GenerationButton
                idleLabel="换一组三种可能"
                runningLabel="正在重新整理"
                retryLabel="重新整理"
                variant="secondary"
                status={generationTask.status}
                errorMessage={errorMessage ?? generationTask.errorMessage}
                onGenerate={handleGenerateStage}
                onCancel={() => cancel(generationKey)}
                useAnimalLoadingButton
              />
              <p className="font-mono text-xs leading-5 text-[var(--echo-muted)]">
                选择后会写入岛民档案，让 TA 的轮廓更清楚。
              </p>
            </div>
          ) : null}

          {isDiaryStage && !currentStage.diaryDraft ? (
            <EmptyState
              icon={StageIcon}
              title="还没有可破译的日记"
              description="先生成一篇被遮住关键处的日记，再补全它。"
              action={
                <GenerationButton
                  idleLabel="生成日记破译"
                  runningLabel="正在整理日记"
                  retryLabel="重新整理"
                  status={generationTask.status}
                  errorMessage={errorMessage ?? generationTask.errorMessage}
                  onGenerate={handleGenerateStage}
                  onCancel={() => cancel(generationKey)}
                  useAnimalLoadingButton
                />
              }
            />
          ) : null}

          {isDiaryStage && currentStage.diaryDraft ? (
            <>
              <DiaryDecodePanel
                draft={currentStage.diaryDraft}
                selections={diarySelections}
                disabled={updateGenerationTask.status === "running"}
                onChange={(blankKey, optionKey) => void handleSelectDiaryBlank(blankKey, optionKey)}
              />
              <div className="echo-mobile-action-row flex flex-wrap items-center gap-4">
                <GenerationButton
                  idleLabel="重新生成日记"
                  runningLabel="正在重新生成日记"
                  retryLabel="重新生成日记"
                  variant="secondary"
                  status={generationTask.status}
                  errorMessage={errorMessage ?? generationTask.errorMessage}
                  onGenerate={handleGenerateStage}
                  onCancel={() => cancel(generationKey)}
                  disabled={updateGenerationTask.status === "running"}
                  useAnimalLoadingButton
                />
                <GenerationButton
                  idleLabel="更新岛民档案"
                  runningLabel="正在更新档案"
                  retryLabel="重新更新"
                  status={activeTask.status}
                  errorMessage={errorMessage ?? activeTask.errorMessage}
                  onGenerate={handleUpdateDossier}
                  onCancel={() => cancel(updateGenerationKey)}
                  disabled={!completedDiaryText || generationTask.status === "running"}
                  className="w-full sm:min-w-[13rem] sm:w-auto"
                  useAnimalLoadingButton
                />
                <p className="max-w-xl text-sm font-bold leading-7 text-[var(--animal-text-muted)]">
                  需要先补全 3 处遮挡。更新后会把本阶段确认的信息写入岛民档案。
                </p>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

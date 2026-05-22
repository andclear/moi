import { ClipboardList, KeyRound, MapPinned, MessageCircleQuestion } from "lucide-react";
import { Collapse, Footer, Typewriter } from "animal-island-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import type { Project } from "@/db/types";
import { projectService } from "@/db/services/projectService";
import { buildDossierBlockMeta } from "@/features/dossier/dossierSections";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { useGenerationStore } from "@/features/generation/generationStore";
import { generateIntakeQuestionnaire, generateProfileDraft } from "@/features/llm/llmClient";
import { buildProfileBrief } from "@/features/profile/profileBrief";
import { createEmptyProfileSession } from "@/features/profile/profileSession";
import { useSettingsStore } from "@/features/settings/settingsStore";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";
import { nowIso } from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";

function extractStreamingDesignNote(content: string) {
  const startMatch = /<cot>/i.exec(content);
  if (startMatch) {
    const afterStart = content.slice(startMatch.index + startMatch[0].length);
    const endMatch = /<\/cot>/i.exec(afterStart);
    return (endMatch ? afterStart.slice(0, endMatch.index) : afterStart).trim();
  }

  const jsonStart = content.indexOf("{");
  const leadingText = (jsonStart >= 0 ? content.slice(0, jsonStart) : content)
    .replace(/<\/?cot>/gi, "")
    .trim();

  return leadingText.startsWith("{") ? "" : leadingText;
}

function createInitialAnswers(project: Project | null | undefined) {
  const answers = project?.intake?.answers ?? [];
  return Object.fromEntries(
    answers.map((answer) => [
      answer.questionId,
      { optionId: answer.optionId, customValue: answer.customValue ?? "" },
    ]),
  ) as Record<string, { optionId: string; customValue: string }>;
}

export function StepQuestionnaire() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [answers, setAnswers] = useState<Record<string, { optionId: string; customValue: string }>>({});
  const [streamedContent, setStreamedContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const generatedForProjectRef = useRef<string | null>(null);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const setRunning = useGenerationStore((state) => state.setRunning);
  const setSucceeded = useGenerationStore((state) => state.setSucceeded);
  const setFailed = useGenerationStore((state) => state.setFailed);
  const cancel = useGenerationStore((state) => state.cancel);
  const questionnaireKey = project ? `intake:${project.id}` : "intake:pending";
  const profileKey = project ? `profile:draft:${project.id}` : "profile:draft:pending";
  const questionnaireTask = useGenerationStore((state) => state.getTask(questionnaireKey));
  const profileTask = useGenerationStore((state) => state.getTask(profileKey));

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let ignored = false;

    async function loadProject() {
      setIsLoading(true);
      const resolvedProject = await projectService.resolveProject(projectId);
      if (ignored) {
        return;
      }

      setProject(resolvedProject ?? null);
      setAnswers(createInitialAnswers(resolvedProject ?? null));
      setIsLoading(false);
    }

    void loadProject();
    return () => {
      ignored = true;
    };
  }, [projectId]);

  const questionnaire = project?.intake?.questionnaire;
  const designNote = streamedContent
    ? extractStreamingDesignNote(streamedContent)
    : questionnaire?.designNote || "";
  const isQuestionnaireRunning =
    questionnaireTask.status === "running" || questionnaireTask.status === "pending";
  const shouldReplayDesignNote = Boolean(designNote) && !streamedContent && !isQuestionnaireRunning;

  const normalizedAnswers = useMemo(() => {
    if (!questionnaire) {
      return [];
    }

    return questionnaire.questions.map((question) => ({
      questionId: question.id,
      optionId: answers[question.id]?.optionId ?? "",
      customValue: answers[question.id]?.customValue?.trim() || undefined,
    }));
  }, [answers, questionnaire]);

  const persistProject = useCallback(async (patch: Partial<Omit<Project, "id" | "createdAt">>) => {
    if (!project) {
      return null;
    }

    const updatedProject = await projectService.updateProject(project.id, patch);
    if (updatedProject) {
      setProject(updatedProject);
      hydrateFromProject(updatedProject);
    }
    return updatedProject;
  }, [hydrateFromProject, project]);

  const handleGenerateQuestionnaire = useCallback(async () => {
    if (!project?.intake) {
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    const controller = new AbortController();
    setErrorMessage(null);
    setStreamedContent("");
    setRunning(questionnaireKey, controller);

    try {
      const result = await generateIntakeQuestionnaire({
        projectId: project.id,
        brief: project.intake.brief,
        gender: project.intake.gender,
        age: project.intake.age,
        signal: controller.signal,
      });
      const updatedProject = await persistProject({
        currentStep: "questionnaire",
        intake: {
          ...project.intake,
          questionnaire: result.data,
          generationId: result.taskId,
        },
      });

      setAnswers(createInitialAnswers(updatedProject));
      setSucceeded(questionnaireKey, result.taskId);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "登岛问卷生成失败。";
      setErrorMessage(message);
      setFailed(questionnaireKey, message);
    }
  }, [
    getAvailability,
    persistProject,
    project,
    questionnaireKey,
    setFailed,
    setRunning,
    setSucceeded,
  ]);

  useEffect(() => {
    if (!project?.intake || project.intake.questionnaire || isLoading) {
      return;
    }
    if (generatedForProjectRef.current === project.id) {
      return;
    }

    generatedForProjectRef.current = project.id;
    void handleGenerateQuestionnaire();
  }, [handleGenerateQuestionnaire, isLoading, project]);

  function validateAnswers() {
    if (!questionnaire) {
      return "问卷还没有准备好。";
    }

    for (const question of questionnaire.questions) {
      const answer = answers[question.id];
      if (!answer?.optionId) {
        return "请先完成所有小岛问卷。";
      }

      const option = question.options.find((item) => item.id === answer.optionId);
      if (option?.allowCustom && !answer.customValue.trim()) {
        return "选择“其他”时，需要写下自己的补充。";
      }
    }

    return null;
  }

  async function handleCreateProfile() {
    if (!project?.intake || !questionnaire) {
      return;
    }

    const validationMessage = validateAnswers();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    const controller = new AbortController();
    setErrorMessage(null);
    setRunning(profileKey, controller);

    try {
      const finalAnswers = normalizedAnswers.filter((answer) => answer.optionId);
      const result = await generateProfileDraft({
        projectId: project.id,
        brief: buildProfileBrief(project, finalAnswers),
        signal: controller.signal,
      });
      const now = nowIso();
      const dossierBlocks = buildDossierBlockMeta(
        result.data.dossierMarkdown,
        project.dossier.blocks,
        "ai_inferred",
        now,
        result.taskId,
      );
      const updatedProject = await persistProject({
        title: result.data.title,
        currentStep: "profile",
        profileSession: createEmptyProfileSession(),
        intake: {
          ...project.intake,
          answers: finalAnswers,
        },
        dossier: {
          markdown: result.data.dossierMarkdown,
          blocks: dossierBlocks,
          updatedAt: now,
        },
      });

      if (!updatedProject) {
        throw new Error("岛民记录保存失败。");
      }

      markStepCompleted("questionnaire");
      setSucceeded(profileKey, result.taskId);
      navigate(`/workspace/${updatedProject.id}/profile`);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "岛民记录生成失败。";
      setErrorMessage(message);
      setFailed(profileKey, message);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[var(--animal-bg)] px-4 py-10">
        <section className="mx-auto w-full max-w-3xl rounded-[34px] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-7 shadow-[0_8px_0_0_var(--animal-shadow-input)]">
          <p className="font-mono text-sm leading-6 text-[var(--animal-text-muted)]">
            正在整理登岛资料……
          </p>
        </section>
      </main>
    );
  }

  if (!project?.intake) {
    return (
      <main className="min-h-screen bg-[var(--animal-bg)] px-4 py-10">
        <section className="mx-auto w-full max-w-3xl rounded-[34px] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-7 text-[var(--animal-text)] shadow-[0_8px_0_0_var(--animal-shadow-input)] sm:p-10">
          <ClipboardList aria-hidden="true" size={28} className="text-[var(--animal-primary)]" />
          <h1 className="mt-4 font-display text-4xl font-black">还没有登岛便笺</h1>
          <p className="mt-3 font-mono text-sm leading-7 text-[var(--animal-text-muted)]">
            先写下一点关于 TA 的线索，才可以领取问卷。
          </p>
          <Button type="button" className="mt-6" onClick={() => navigate("/workspace/current/post")}>
            返回岛民便笺
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--animal-bg)] text-[var(--animal-text)]">
      <article className="mx-auto my-4 w-[calc(100%-1rem)] max-w-4xl overflow-hidden rounded-[28px] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-4 shadow-[0_10px_0_0_var(--animal-shadow-input)] sm:my-12 sm:w-[calc(100%-2rem)] sm:rounded-[34px] sm:p-9">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-stamp)]">
          登岛小问卷
        </p>
        <h1 className="mt-3 font-display text-4xl font-black sm:text-5xl">
          先问几个小问题，再去认识 TA
        </h1>
        <p className="mt-4 max-w-3xl font-mono text-sm leading-7 text-[var(--animal-text-muted)]">
          这张问卷会根据你刚写下的线索自动生成，用来确认世界观、相处感和关键反差。
        </p>

        <div className="mt-8 grid gap-6">
          <Collapse
            question="设计说明"
            defaultExpanded
            className="echo-questionnaire-collapse"
            answer={
              <div className="min-h-20 whitespace-pre-wrap font-mono text-sm leading-7 text-[var(--animal-text-muted)]">
                {shouldReplayDesignNote ? (
                  <Typewriter speed={18} trigger={designNote}>
                    {designNote}
                  </Typewriter>
                ) : designNote ? (
                  designNote
                ) : (
                  "正在登岛，领取小问卷中...."
                )}
              </div>
            }
          />

          {questionnaire ? (
            <div className="grid gap-5">
              <h2 className="font-display text-3xl font-black text-[var(--animal-text)]">
                {questionnaire.title}
              </h2>
              {questionnaire.questions.map((question, index) => {
                const selectedOption = question.options.find(
                  (option) => option.id === answers[question.id]?.optionId,
                );
                return (
                  <fieldset
                    key={question.id}
                    className="rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.48)] p-4"
                  >
                    <legend className="px-2 text-base font-black text-[var(--animal-text)]">
                      {index + 1}. {question.title}
                    </legend>
                    {question.description && (
                      <p className="mt-2 font-mono text-xs leading-5 text-[var(--animal-text-muted)]">
                        {question.description}
                      </p>
                    )}
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                      {question.options.map((option) => {
                        const isSelected = answers[question.id]?.optionId === option.id;
                        return (
                          <label
                            key={option.id}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-2 rounded-[var(--animal-radius-pill)] border-2 px-4 py-2 text-sm font-bold shadow-[0_3px_0_0_var(--animal-shadow-input)] transition-all",
                              isSelected
                                ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
                                : "border-[var(--animal-border)] bg-[var(--animal-bg-content)] text-[var(--animal-text-body)] hover:-translate-y-0.5 hover:border-[var(--animal-primary)]",
                            )}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={option.id}
                              checked={isSelected}
                              onChange={() =>
                                setAnswers((current) => ({
                                  ...current,
                                  [question.id]: {
                                    optionId: option.id,
                                    customValue: current[question.id]?.customValue ?? "",
                                  },
                                }))
                              }
                              className="h-4 w-4 accent-[var(--animal-primary)]"
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                    {selectedOption?.allowCustom && (
                      <input
                        type="text"
                        value={answers[question.id]?.customValue ?? ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: {
                              optionId: current[question.id]?.optionId ?? selectedOption.id,
                              customValue: event.target.value,
                            },
                          }))
                        }
                        className="mt-4 h-12 w-full rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-input)] px-5 text-base font-bold text-[var(--animal-text-body)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none placeholder:text-[var(--animal-text-disabled)] focus:border-[var(--animal-focus-yellow)] focus:shadow-[0_3px_0_0_var(--animal-focus-yellow-dark)]"
                        placeholder="写下你的补充"
                      />
                    )}
                  </fieldset>
                );
              })}

              {errorMessage && (
                <p className="flex flex-wrap items-start gap-2 font-mono text-sm leading-6 text-[var(--echo-stamp)]">
                  <MessageCircleQuestion aria-hidden="true" size={17} className="mt-1 shrink-0" />
                  {errorMessage}
                  {errorMessage.includes("尚未连接模型") && (
                    <Button asChild variant="ghost" className="h-auto px-1 py-0">
                      <Link to="/settings">
                        <KeyRound aria-hidden="true" size={15} />
                        前往设置
                      </Link>
                    </Button>
                  )}
                </p>
              )}

              <GenerationButton
                idleLabel="带着问卷去认识 TA"
                runningLabel="正在整理回答"
                retryLabel="重新整理回答"
                status={profileTask.status}
                errorMessage={profileTask.errorMessage}
                onGenerate={handleCreateProfile}
                onCancel={() => cancel(profileKey)}
                className="h-14 w-full max-w-sm border-[var(--animal-primary-active)] bg-[var(--animal-primary)] px-7 text-base text-white shadow-[0_6px_0_0_var(--animal-primary-active)]"
              />
            </div>
          ) : (
            <section className="rounded-[var(--animal-radius-lg)] border-2 border-dashed border-[var(--animal-border)] bg-[rgba(255,255,255,0.34)] p-6">
              <MapPinned aria-hidden="true" size={26} className="text-[var(--animal-primary)]" />
              <h2 className="mt-4 font-display text-3xl font-black text-[var(--animal-text)]">
                正在领取登岛小问卷
              </h2>
              <p className="mt-3 font-mono text-sm leading-7 text-[var(--animal-text-muted)]">
                岛务处正在根据线索准备题目。如果等待太久，可以重新领取一次。
              </p>
              <div className="mt-5">
                <GenerationButton
                  idleLabel="重新领取问卷"
                  runningLabel="正在领取问卷"
                  retryLabel="重新领取问卷"
                  status={questionnaireTask.status}
                  errorMessage={errorMessage ?? questionnaireTask.errorMessage}
                  onGenerate={handleGenerateQuestionnaire}
                  onCancel={() => cancel(questionnaireKey)}
                  useAnimalLoadingButton
                />
              </div>
            </section>
          )}
        </div>
        <div className="echo-questionnaire-footer-wrap -mx-5 -mb-5 mt-8 overflow-hidden sm:-mx-9 sm:-mb-9">
          <Footer type="sea" className="echo-questionnaire-footer" />
        </div>
      </article>
    </main>
  );
}

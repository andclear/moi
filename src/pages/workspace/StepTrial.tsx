import { Collapse } from "animal-island-ui";
import { AlertTriangle, CheckCircle2, MessageSquareWarning, ScrollText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type { Project, TrialAnswer, TrialQuestion, TrialRun } from "@/db/types";
import { historyService } from "@/db/services/historyService";
import { projectService } from "@/db/services/projectService";
import { buildDossierBlockMeta } from "@/features/dossier/dossierSections";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { useGenerationStore } from "@/features/generation/generationStore";
import {
  generateTrialAnswerSet,
  generateTrialQuestionnaireSet,
  generateTrialRevision,
} from "@/features/llm/llmClient";
import { useSettingsStore } from "@/features/settings/settingsStore";
import {
  createTrialRun,
  getConfirmedWorldEntries,
  getSelectedGreeting,
  mergeTrialModeResults,
  replaceLatestTrialRun,
  trialModeIntentLabels,
  trialModeLabels,
  trialModes,
  type TrialMode,
} from "@/features/trial/trialStore";
import { EmptyState } from "@/shared/components/EmptyState";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";
import { nowIso } from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";

type TrialGenerationStage = "idle" | "questionnaire" | "answer";

type RevisionChange = {
  source: "dossier" | "character_info" | "worldinfo" | "greeting";
  targetId?: string;
  title: string;
  before: string;
  after: string;
  reason: string;
};

type RevisionDraft = {
  summary: string;
  changes: RevisionChange[];
};

type RevisionTarget = {
  mode: TrialMode;
  question: TrialQuestion;
  answer: TrialAnswer;
};

const sourceLabels: Record<RevisionChange["source"], string> = {
  dossier: "角色档案",
  character_info: "角色信息",
  worldinfo: "WorldInfo",
  greeting: "开场白",
};

export function StepTrial() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMode, setActiveMode] = useState<TrialMode>("interview");
  const [generationStage, setGenerationStage] = useState<TrialGenerationStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<RevisionTarget | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisionDraft, setRevisionDraft] = useState<RevisionDraft | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [isRevising, setIsRevising] = useState(false);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const generationKey = project ? `trial:${project.id}:final` : "trial:pending";
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

  async function persistProject(
    nextProject: Project,
    snapshotTitle?: string,
    generationIds: string[] = [],
  ) {
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

  async function handleRunTrial() {
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
    setGenerationStage("questionnaire");
    setRunning(generationKey, controller);

    try {
      const confirmedEntries = getConfirmedWorldEntries(project);
      const selectedGreeting = getSelectedGreeting(project);
      const characterInfoYaml = project.characterProfile?.yaml;
      const questionnaire = await generateTrialQuestionnaireSet({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        characterInfoYaml,
        confirmedEntries,
        selectedGreeting,
        signal: controller.signal,
      });
      setGenerationStage("answer");
      const answer = await generateTrialAnswerSet({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        characterInfoYaml,
        confirmedEntries,
        selectedGreeting,
        questionnaires: JSON.stringify(questionnaire.data),
        signal: controller.signal,
      });
      const modeResults = mergeTrialModeResults({
        questionnaires: questionnaire.data.modes,
        answers: answer.data.modes,
      });
      const trialRun = createTrialRun({
        projectId: project.id,
        modeResults,
      });
      const nextProject = replaceLatestTrialRun(project, trialRun);

      await persistProject(nextProject, "完成终审测试", [questionnaire.taskId, answer.taskId]);
      setSucceeded(generationKey, answer.taskId);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "终审测试生成失败。";
      setErrorMessage(message);
      setFailed(generationKey, message);
    } finally {
      setGenerationStage("idle");
    }
  }

  async function handlePassTrial() {
    if (!project) {
      return;
    }

    const updatedProject = await persistProject(
      {
        ...project,
        currentStep: "hello",
      },
      "通过终审测试",
    );

    if (updatedProject) {
      markStepCompleted("trial");
      navigate(`/workspace/${updatedProject.id}/hello`);
    }
  }

  function openRevisionDialog(target: RevisionTarget) {
    setRevisionTarget(target);
    setRevisionNotes("");
    setRevisionDraft(null);
    setRevisionError(null);
  }

  function closeRevisionDialog() {
    if (isRevising) {
      return;
    }
    setRevisionTarget(null);
    setRevisionNotes("");
    setRevisionDraft(null);
    setRevisionError(null);
  }

  async function handleCreateRevision() {
    if (!project || !revisionTarget || !revisionNotes.trim()) {
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setRevisionError("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    setIsRevising(true);
    setRevisionError(null);
    try {
      const result = await generateTrialRevision({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        characterInfoYaml: project.characterProfile?.yaml,
        confirmedEntries: getConfirmedWorldEntries(project),
        selectedGreeting: getSelectedGreeting(project),
        mode: revisionTarget.mode,
        question: revisionTarget.question.question,
        formalReply: revisionTarget.answer.formalReply,
        innerMonologue: revisionTarget.answer.innerMonologue,
        revisionNotes: revisionNotes.trim(),
      });
      setRevisionDraft(result.data);
    } catch (error) {
      setRevisionError(error instanceof Error ? error.message : "修改建议生成失败。");
    } finally {
      setIsRevising(false);
    }
  }

  async function handleApplyRevision() {
    if (!project || !revisionDraft) {
      return;
    }

    try {
      const nextProject = applyRevisionDraft(project, revisionDraft);
      await persistProject(nextProject, "根据终审反馈修改角色资料");
      closeRevisionDialog();
    } catch (error) {
      setRevisionError(error instanceof Error ? error.message : "保存修改失败。");
    }
  }

  const latestRun = project?.trialRuns[0];
  const runningLabel =
    generationStage === "answer" ? "{{char}}正在埋头作答..." : "正在向{{char}}发放问卷...";

  if (isLoading) {
    return (
      <div className="p-6 font-mono text-sm text-[var(--echo-muted)]">正在整理终审测试记录……</div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <EmptyState title="这里还没有 TA" description="先找到 TA，才能进行终审测试。" />
      </div>
    );
  }

  return (
    <main className="echo-workspace-page">
      <div className="echo-workspace-inner space-y-6">
        <section className="echo-section-card">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            角色终审
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
            看看 TA 是否经得起终审
          </h1>
          <p className="mt-3 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            一次生成三份问卷和三组回答，正式回复、内心独白与 OOC 风险会长期保存在本地。
          </p>
        </section>

        <section className="echo-text-card">
          <div className="flex items-center gap-3">
            <ScrollText aria-hidden="true" size={22} className="text-[var(--animal-primary)]" />
            <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">测试模式</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {trialModes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setActiveMode(mode)}
                className={cn(
                  "border-2 px-4 py-3 text-left font-display text-lg font-black transition-colors",
                  activeMode === mode
                    ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
                    : "border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] text-[var(--echo-text)] hover:border-[var(--echo-paper)]",
                )}
              >
                {trialModeLabels[mode]}
              </button>
            ))}
          </div>
          <div className="mt-5 max-w-sm">
            <GenerationButton
              idleLabel={latestRun ? "重新测试" : "开始终审"}
              runningLabel={runningLabel}
              retryLabel="重新测试"
              status={generationTask.status}
              errorMessage={errorMessage ?? generationTask.errorMessage}
              onGenerate={handleRunTrial}
              onCancel={() => {
                cancel(generationKey);
                setGenerationStage("idle");
              }}
            />
          </div>
        </section>

        <section className="echo-readable-main">
          {!latestRun ? (
            <EmptyState
              icon={ScrollText}
              title="还没有终审记录"
              description="开始终审后，会一次性生成三类问卷和回答。"
            />
          ) : latestRun.modeResults ? (
            <TrialResultTabs
              trialRun={latestRun}
              activeMode={activeMode}
              onActiveModeChange={setActiveMode}
              onUnsatisfied={openRevisionDialog}
            />
          ) : (
            <LegacyTrialRunCard trialRun={latestRun} />
          )}

          {project.trialRuns.slice(1).length > 0 && (
            <div className="mt-5 grid gap-3">
              {project.trialRuns.slice(1).map((trialRun) => (
                <LegacyTrialRunCard key={trialRun.id} trialRun={trialRun} compact />
              ))}
            </div>
          )}
        </section>

        <section className="echo-text-card flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">终审确认</h2>
            <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
              确认角色行为符合预期后，进入“打个招呼”。
            </p>
          </div>
          <Button type="button" disabled={!latestRun} onClick={() => void handlePassTrial()}>
            <CheckCircle2 aria-hidden="true" size={16} />
            通过终审
          </Button>
        </section>
      </div>

      <RevisionDialog
        target={revisionTarget}
        notes={revisionNotes}
        draft={revisionDraft}
        errorMessage={revisionError}
        isLoading={isRevising}
        onNotesChange={setRevisionNotes}
        onCreateRevision={() => void handleCreateRevision()}
        onApplyRevision={() => void handleApplyRevision()}
        onClose={closeRevisionDialog}
      />
    </main>
  );
}

function TrialResultTabs({
  trialRun,
  activeMode,
  onActiveModeChange,
  onUnsatisfied,
}: {
  trialRun: TrialRun;
  activeMode: TrialMode;
  onActiveModeChange: (mode: TrialMode) => void;
  onUnsatisfied: (target: RevisionTarget) => void;
}) {
  const activeResult = trialRun.modeResults?.[activeMode];
  const riskCount = useMemo(
    () =>
      activeResult?.answers.reduce((total, answer) => total + answer.riskSentences.length, 0) ?? 0,
    [activeResult],
  );

  if (!activeResult) {
    return null;
  }

  return (
    <article className="echo-text-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--echo-muted)]">
            最近一次终审
          </p>
          <h2 className="mt-2 font-display text-2xl font-black text-[var(--echo-paper)]">
            {trialModeLabels[activeMode]}
          </h2>
          <p className="mt-1 font-mono text-xs text-[var(--echo-muted)]">
            {trialModeIntentLabels[activeMode]}
          </p>
        </div>
        {(activeResult.riskNotes.length > 0 || riskCount > 0) && (
          <span className="inline-flex items-center gap-2 border border-[var(--echo-stamp)] px-2 py-1 font-mono text-xs text-[var(--echo-stamp)]">
            <AlertTriangle aria-hidden="true" size={14} />
            {activeResult.riskNotes.length + riskCount} 条风险
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="终审测试结果">
        {trialModes.map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={activeMode === mode}
            onClick={() => onActiveModeChange(mode)}
            className={cn(
              "border-2 px-4 py-2 font-display text-sm font-black transition-colors",
              activeMode === mode
                ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
                : "border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] text-[var(--echo-text)] hover:border-[var(--echo-paper)]",
            )}
          >
            {trialModeLabels[mode]}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {activeResult.questions.map((question, index) => {
          const answer = activeResult.answers.find((item) => item.questionId === question.id);
          return (
            <Collapse
              key={question.id}
              defaultExpanded={index === 0}
              question={
                <span className="block text-left">
                  <span className="font-display text-base font-black text-[var(--animal-text)]">
                    {index + 1}. {question.interviewer ? `${question.interviewer}：` : ""}
                    {question.question}
                  </span>
                </span>
              }
              answer={
                <div className="space-y-4 pt-3">
                  {question.intent && (
                    <p className="font-mono text-xs leading-5 text-[var(--echo-muted)]">
                      测试目的：{question.intent}
                    </p>
                  )}
                  <AnswerBlock
                    answer={answer}
                    mode={activeMode}
                    question={question}
                    onUnsatisfied={onUnsatisfied}
                  />
                </div>
              }
            />
          );
        })}
      </div>

      {activeResult.riskNotes.length > 0 && (
        <section className="mt-5 border border-[var(--echo-stamp)] bg-[rgba(122,43,38,0.1)] p-3">
          <h3 className="font-display text-lg font-black text-[var(--echo-paper)]">OOC 风险</h3>
          <ul className="mt-2 space-y-2 font-mono text-xs leading-6 text-[var(--echo-stamp)]">
            {activeResult.riskNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function AnswerBlock({
  answer,
  mode,
  question,
  onUnsatisfied,
}: {
  answer?: TrialAnswer;
  mode: TrialMode;
  question: TrialQuestion;
  onUnsatisfied: (target: RevisionTarget) => void;
}) {
  if (!answer) {
    return <p className="font-mono text-sm text-[var(--echo-muted)]">这道题还没有回答。</p>;
  }

  return (
    <div className="space-y-4">
      <section className="border border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-4">
        <h4 className="font-display text-base font-black text-[var(--echo-paper)]">正式回复</h4>
        <p className="echo-long-text mt-2 font-mono text-sm text-[var(--echo-text)]">
          {answer.formalReply}
        </p>
      </section>
      <section className="border border-[var(--echo-line)] bg-[rgba(255,255,255,0.45)] p-4">
        <h4 className="font-display text-base font-black text-[var(--echo-paper)]">内心独白</h4>
        <p className="echo-long-text mt-2 font-mono text-sm text-[var(--echo-muted)]">
          {answer.innerMonologue}
        </p>
      </section>
      {answer.riskSentences.length > 0 && (
        <section className="border border-[var(--echo-stamp)] bg-[rgba(122,43,38,0.1)] p-3">
          <h4 className="font-display text-base font-black text-[var(--echo-paper)]">高亮风险句</h4>
          <ul className="mt-2 space-y-2 font-mono text-xs leading-6 text-[var(--echo-stamp)]">
            {answer.riskSentences.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>
        </section>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onUnsatisfied({ mode, question, answer })}
      >
        <MessageSquareWarning aria-hidden="true" size={15} />
        不满意
      </Button>
    </div>
  );
}

function LegacyTrialRunCard({
  trialRun,
  compact = false,
}: {
  trialRun: TrialRun;
  compact?: boolean;
}) {
  return (
    <article className="echo-text-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--echo-muted)]">
            历史终审记录
          </p>
          <h2 className="mt-2 font-display text-2xl font-black text-[var(--echo-paper)]">
            {compact ? "测试记录" : "旧版测试记录"}
          </h2>
        </div>
        {trialRun.riskNotes.length > 0 && (
          <span className="inline-flex items-center gap-2 border border-[var(--echo-stamp)] px-2 py-1 font-mono text-xs text-[var(--echo-stamp)]">
            <AlertTriangle aria-hidden="true" size={14} />
            {trialRun.riskNotes.length} 条风险
          </span>
        )}
      </div>
      {!compact && (
        <section className="mt-4 border border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-4">
          <h3 className="font-display text-lg font-black text-[var(--echo-paper)]">问卷</h3>
          <p className="echo-long-text mt-2 font-mono text-[var(--echo-muted)]">
            {trialRun.questionnaireMarkdown}
          </p>
        </section>
      )}
      <section className="mt-4 border border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-4">
        <h3 className="font-display text-lg font-black text-[var(--echo-paper)]">回答</h3>
        <p className="echo-long-text mt-2 font-mono text-[var(--echo-text)]">
          {trialRun.resultMarkdown}
        </p>
      </section>
    </article>
  );
}

function RevisionDialog({
  target,
  notes,
  draft,
  errorMessage,
  isLoading,
  onNotesChange,
  onCreateRevision,
  onApplyRevision,
  onClose,
}: {
  target: RevisionTarget | null;
  notes: string;
  draft: RevisionDraft | null;
  errorMessage: string | null;
  isLoading: boolean;
  onNotesChange: (value: string) => void;
  onCreateRevision: () => void;
  onApplyRevision: () => void;
  onClose: () => void;
}) {
  if (!target) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(61,52,40,0.45)] p-4">
      <section className="max-h-[88vh] w-full max-w-3xl overflow-auto border-2 border-[var(--echo-line)] bg-[var(--animal-bg-content)] p-5 shadow-[0_8px_24px_rgba(61,52,40,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
              不满意这次回答
            </h2>
            <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
              写下原因后，AI 会返回资料修改建议。确认前不会保存。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="border-2 border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-2 text-[var(--echo-text)]"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="mt-4 border border-[var(--echo-line)] bg-[rgba(247,243,223,0.7)] p-3">
          <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">当前问题</p>
          <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-text)]">
            {target.question.question}
          </p>
        </div>

        <label className="mt-4 block">
          <span className="font-mono text-xs font-bold text-[var(--echo-muted)]">
            修改意见或不满意原因
          </span>
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            className="mt-2 min-h-28 w-full border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.68)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--animal-primary)]"
            placeholder="例如：这句话太强硬，不像 TA；内心独白没有体现 TA 对 {{user}} 的保护欲。"
          />
        </label>

        {errorMessage && (
          <p className="mt-3 border border-[var(--echo-stamp)] bg-[rgba(122,43,38,0.1)] p-3 font-mono text-xs leading-6 text-[var(--echo-stamp)]">
            {errorMessage}
          </p>
        )}

        {draft && (
          <section className="mt-5 space-y-3">
            <h3 className="font-display text-xl font-black text-[var(--echo-paper)]">
              {draft.summary}
            </h3>
            {draft.changes.map((change, index) => (
              <article
                key={`${change.source}-${change.title}-${index}`}
                className="border border-[var(--echo-line)] bg-[rgba(255,255,255,0.45)] p-4"
              >
                <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">
                  {sourceLabels[change.source]} · {change.title}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">修改前</p>
                    <p className="echo-long-text mt-2 border border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-3 font-mono text-xs text-[var(--echo-text)]">
                      {change.before}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">修改后</p>
                    <p className="echo-long-text mt-2 border border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] p-3 font-mono text-xs text-[var(--animal-text)]">
                      {change.after}
                    </p>
                  </div>
                </div>
                <p className="mt-3 font-mono text-xs leading-5 text-[var(--echo-muted)]">
                  {change.reason}
                </p>
              </article>
            ))}
          </section>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            取消
          </Button>
          {!draft ? (
            <Button
              type="button"
              loading={isLoading}
              disabled={!notes.trim() || isLoading}
              onClick={onCreateRevision}
            >
              生成修改建议
            </Button>
          ) : (
            <Button type="button" onClick={onApplyRevision}>
              确认并保存
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function applyRevisionDraft(project: Project, draft: RevisionDraft) {
  const now = nowIso();
  let dossierMarkdown = project.dossier.markdown;
  let characterInfoYaml = project.characterProfile?.yaml ?? "";
  let worldEntries = project.worldEntries;
  let greetingVariants = project.greetingVariants;
  let appliedCount = 0;

  for (const change of draft.changes) {
    if (change.source === "dossier" && dossierMarkdown.includes(change.before)) {
      dossierMarkdown = dossierMarkdown.replace(change.before, change.after);
      appliedCount += 1;
    }

    if (change.source === "character_info" && characterInfoYaml.includes(change.before)) {
      characterInfoYaml = characterInfoYaml.replace(change.before, change.after);
      appliedCount += 1;
    }

    if (change.source === "worldinfo") {
      let didApply = false;
      worldEntries = worldEntries.map((entry) => {
        if (didApply) {
          return entry;
        }
        const isTarget = change.targetId
          ? entry.id === change.targetId
          : entry.content.includes(change.before);
        if (!isTarget || !entry.content.includes(change.before)) {
          return entry;
        }
        didApply = true;
        appliedCount += 1;
        return {
          ...entry,
          content: entry.content.replace(change.before, change.after),
          updatedAt: now,
        };
      });
    }

    if (change.source === "greeting") {
      let didApply = false;
      greetingVariants = greetingVariants.map((variant) => {
        if (didApply) {
          return variant;
        }
        const isTarget = change.targetId
          ? variant.id === change.targetId
          : variant.content.includes(change.before);
        if (!isTarget || !variant.content.includes(change.before)) {
          return variant;
        }
        didApply = true;
        appliedCount += 1;
        return {
          ...variant,
          content: variant.content.replace(change.before, change.after),
          updatedAt: now,
        };
      });
    }
  }

  if (appliedCount === 0) {
    throw new Error("没有找到可替换的原文，请重新生成修改建议。");
  }

  return {
    ...project,
    dossier: {
      ...project.dossier,
      markdown: dossierMarkdown,
      blocks:
        dossierMarkdown === project.dossier.markdown
          ? project.dossier.blocks
          : buildDossierBlockMeta(dossierMarkdown, project.dossier.blocks, "ai_inferred", now),
      updatedAt: dossierMarkdown === project.dossier.markdown ? project.dossier.updatedAt : now,
    },
    characterProfile: project.characterProfile
      ? {
          ...project.characterProfile,
          yaml: characterInfoYaml,
          updatedAt:
            characterInfoYaml === project.characterProfile.yaml
              ? project.characterProfile.updatedAt
              : now,
        }
      : project.characterProfile,
    worldEntries,
    greetingVariants,
    updatedAt: now,
  } satisfies Project;
}

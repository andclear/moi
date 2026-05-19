import { AlertTriangle, CheckCircle2, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type { Project, TrialRun } from "@/db/types";
import { historyService } from "@/db/services/historyService";
import { projectService } from "@/db/services/projectService";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { useGenerationStore } from "@/features/generation/generationStore";
import { generateTrialAnswer, generateTrialQuestionnaire } from "@/features/llm/llmClient";
import { useSettingsStore } from "@/features/settings/settingsStore";
import {
  appendTrialRun,
  createTrialRun,
  getConfirmedWorldEntries,
  getSelectedGreeting,
  trialModeDescriptions,
  trialModeLabels,
  type TrialMode,
} from "@/features/trial/trialStore";
import { EmptyState } from "@/shared/components/EmptyState";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

const trialModes = Object.keys(trialModeLabels) as TrialMode[];

export function StepTrial() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<TrialMode>("interview");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const generationKey = project ? `trial:${project.id}:${mode}` : "trial:pending";
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
    setRunning(generationKey, controller);

    try {
      const confirmedEntries = getConfirmedWorldEntries(project);
      const selectedGreeting = getSelectedGreeting(project);
      const questionnaire = await generateTrialQuestionnaire({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        confirmedEntries,
        selectedGreeting,
        mode,
        signal: controller.signal,
      });
      const answer = await generateTrialAnswer({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        confirmedEntries,
        selectedGreeting,
        mode,
        questionnaireMarkdown: questionnaire.data.questionnaireMarkdown,
        signal: controller.signal,
      });
      const trialRun = createTrialRun({
        projectId: project.id,
        mode,
        questionnaireMarkdown: questionnaire.data.questionnaireMarkdown,
        resultMarkdown: answer.data.resultMarkdown,
        riskNotes: answer.data.riskNotes,
      });
      const nextProject = appendTrialRun(project, trialRun);

    await persistProject(nextProject, `完成相处测试：${trialModeLabels[mode]}`, [
        questionnaire.taskId,
        answer.taskId,
      ]);
      setSucceeded(generationKey, answer.taskId);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "相处测试生成失败。";
      setErrorMessage(message);
      setFailed(generationKey, message);
    }
  }

  async function handlePassTrial() {
    if (!project) {
      return;
    }

    const updatedProject = await persistProject(
      {
        ...project,
        currentStep: "export",
      },
      "通过相处测试",
    );

    if (updatedProject) {
      markStepCompleted("trial");
      navigate(`/workspace/${updatedProject.id}/export`);
    }
  }

  if (isLoading) {
    return <div className="p-6 font-mono text-sm text-[var(--echo-muted)]">正在整理相处测试记录……</div>;
  }

  if (!project) {
    return (
      <div className="p-6">
        <EmptyState title="这里还没有 TA" description="先找到 TA，才能进行相处测试。" />
      </div>
    );
  }

  const latestRun = project.trialRuns[0];

  return (
    <main className="min-h-[calc(100vh-9rem)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="border-2 border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-5 shadow-[0_4px_10px_rgba(107,92,67,0.28)]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            角色一致性
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
            看看 TA 在相处中是否稳定
          </h1>
          <p className="mt-3 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            相处测试会先生成问卷，再让 TA 作答。正式回复、内心独白和 OOC 风险会长期保存在本地。
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4">
            <ScrollText aria-hidden="true" size={22} className="text-[var(--echo-muted)]" />
            <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">测试模式</h2>
            <div className="space-y-2">
              {trialModes.map((trialMode) => (
                <button
                  key={trialMode}
                  type="button"
                  onClick={() => setMode(trialMode)}
                  className={cn(
                    "w-full border-2 p-3 text-left transition-colors",
                    mode === trialMode
                      ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
                      : "border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] text-[var(--echo-text)] hover:border-[var(--echo-paper)]",
                  )}
                >
                  <span className="font-display text-lg font-black">{trialModeLabels[trialMode]}</span>
                  <span className="mt-1 block font-mono text-xs leading-5 opacity-75">
                    {trialModeDescriptions[trialMode]}
                  </span>
                </button>
              ))}
            </div>
            <GenerationButton
              idleLabel={latestRun ? "重新测试" : "开始测试"}
              runningLabel="正在测试"
              retryLabel="重新测试"
              status={generationTask.status}
              errorMessage={errorMessage ?? generationTask.errorMessage}
              onGenerate={handleRunTrial}
              onCancel={() => cancel(generationKey)}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!latestRun}
              onClick={() => void handlePassTrial()}
            >
              <CheckCircle2 aria-hidden="true" size={16} />
              通过测试
            </Button>
          </aside>

          <div className="space-y-4">
            {!latestRun ? (
              <EmptyState
                icon={ScrollText}
                title="还没有测试记录"
                description="选择一种测试模式，听听 TA 在不同压力下是否仍然像 TA。"
              />
            ) : (
              <TrialRunCard trialRun={latestRun} />
            )}

            {project.trialRuns.slice(1).length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {project.trialRuns.slice(1).map((trialRun) => (
                  <TrialRunCard key={trialRun.id} trialRun={trialRun} compact />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function TrialRunCard({ trialRun, compact = false }: { trialRun: TrialRun; compact?: boolean }) {
  return (
    <article className="border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--echo-muted)]">
            {trialModeLabels[trialRun.mode]}
          </p>
          <h2 className="mt-2 font-display text-2xl font-black text-[var(--echo-paper)]">
            {compact ? "测试记录" : "最近一次测试"}
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
        <section className="mt-4 border border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-3">
          <h3 className="font-display text-lg font-black text-[var(--echo-paper)]">问卷</h3>
          <p className="mt-2 whitespace-pre-wrap font-mono text-xs leading-6 text-[var(--echo-muted)]">
            {trialRun.questionnaireMarkdown}
          </p>
        </section>
      )}
      <section className="mt-4 border border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-3">
        <h3 className="font-display text-lg font-black text-[var(--echo-paper)]">回答</h3>
        <p className="mt-2 whitespace-pre-wrap font-mono text-sm leading-7 text-[var(--echo-text)]">
          {trialRun.resultMarkdown}
        </p>
      </section>
      {trialRun.riskNotes.length > 0 && (
        <section className="mt-4 border border-[var(--echo-stamp)] bg-[rgba(122,43,38,0.1)] p-3">
          <h3 className="font-display text-lg font-black text-[var(--echo-paper)]">OOC 风险</h3>
          <ul className="mt-2 space-y-2 font-mono text-xs leading-6 text-[var(--echo-stamp)]">
            {trialRun.riskNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

import { FileSearch, KeyRound, MessageCircleQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { projectRepository } from "@/db/repositories/projectRepository";
import { projectService } from "@/db/services/projectService";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { useGenerationStore } from "@/features/generation/generationStore";
import { generateProfileDraft } from "@/features/llm/llmClient";
import { useSettingsStore } from "@/features/settings/settingsStore";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";
import { buildDossierBlockMeta } from "@/features/dossier/dossierSections";
import { nowIso } from "@/shared/lib/date";

export function StepPost() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const generationTask = useGenerationStore((state) => state.getTask("profile:draft"));
  const setRunning = useGenerationStore((state) => state.setRunning);
  const setSucceeded = useGenerationStore((state) => state.setSucceeded);
  const setFailed = useGenerationStore((state) => state.setFailed);
  const cancel = useGenerationStore((state) => state.cancel);
  const hydrateDossier = useDossierStore((state) => state.hydrateFromProject);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleStartProfile() {
    const trimmedBrief = brief.trim();
    setErrorMessage(null);

    if (trimmedBrief.length < 12) {
      setHint("再留下一点点线索吧。比如 TA 在什么场景里出现，或 TA 最不像谁。");
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    const controller = new AbortController();
    setRunning("profile:draft", controller);

    try {
      const draftProject = await projectRepository.create({
        title: trimmedBrief.length > 18 ? `${trimmedBrief.slice(0, 18)}…` : trimmedBrief,
      });
      const result = await generateProfileDraft({
        projectId: draftProject.id,
        brief: trimmedBrief,
        signal: controller.signal,
      });
      const now = nowIso();
      const dossierBlocks = buildDossierBlockMeta(
        result.data.dossierMarkdown,
        draftProject.dossier.blocks,
        "ai_inferred",
        now,
        result.taskId,
      );
      const updatedProject = await projectService.updateProject(draftProject.id, {
        title: result.data.title,
        currentStep: "profile",
        dossier: {
          markdown: result.data.dossierMarkdown,
          blocks: dossierBlocks,
          updatedAt: now,
        },
      });

      if (!updatedProject) {
        throw new Error("初始档案保存失败。");
      }

      hydrateDossier(updatedProject);
      markStepCompleted("post");
      setSucceeded("profile:draft", result.taskId);
      navigate(`/workspace/${updatedProject.id}/profile`);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : "初始侧写生成失败。";
      setErrorMessage(message);
      setFailed("profile:draft", message);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-20">
      <article className="w-full max-w-3xl border-2 border-[var(--echo-line)] bg-[var(--echo-paper)] p-5 text-[var(--echo-ink)] shadow-[10px_10px_0_var(--echo-shadow)] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-stamp)]">
          张贴寻人启事
        </p>
        <h1 className="mt-5 font-display text-4xl font-black tracking-normal sm:text-5xl">
          你记得 TA 的哪一部分？
        </h1>
        <p className="mt-5 max-w-2xl font-mono text-base leading-7">
          不必急着说清 TA 是谁。写下一点气息、一句话、一个场景、一段你无法忘记的矛盾，或那个始终没有散去的瞬间。
        </p>
        <div className="mt-8">
          <label htmlFor="case-brief" className="sr-only">
            最初的回音
          </label>
          <textarea
            id="case-brief"
            value={brief}
            onChange={(event) => {
              setBrief(event.target.value);
              setHint(null);
            }}
            className="min-h-56 w-full resize-y border-0 border-b-2 border-[var(--echo-ink)] bg-transparent p-0 font-mono text-lg leading-9 outline-none placeholder:text-[rgba(36,49,65,0.45)] focus:border-[var(--echo-stamp)]"
            placeholder="比如：TA 总在雨夜出现，话很少，像在等一封永远不会抵达的信。"
          />
        </div>
        {hint && (
          <p className="mt-4 flex items-start gap-2 font-mono text-sm leading-6 text-[var(--echo-stamp)]">
            <MessageCircleQuestion aria-hidden="true" size={17} className="mt-1 shrink-0" />
            {hint}
          </p>
        )}
        {errorMessage && (
          <div className="mt-5 border border-[var(--echo-stamp)] bg-[rgba(122,43,38,0.08)] p-4 font-mono text-sm leading-6 text-[var(--echo-stamp)]">
            {errorMessage}
            <Button asChild variant="ghost" className="ml-2 h-auto px-1 py-0">
              <Link to="/settings">
                <KeyRound aria-hidden="true" size={15} />
                前往设置
              </Link>
            </Button>
          </div>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <GenerationButton
            idleLabel="开始辨认轮廓"
            runningLabel="正在听见最初的回音"
            status={generationTask.status}
            errorMessage={generationTask.errorMessage}
            onGenerate={handleStartProfile}
            onCancel={() => cancel("profile:draft")}
          />
          <p className="font-mono text-xs leading-5 text-[rgba(36,49,65,0.68)]">
            <FileSearch aria-hidden="true" size={14} className="mr-1 inline" />
            生成后会自动写入 TA 的回音，并进入辨认轮廓。
          </p>
        </div>
      </article>
    </div>
  );
}

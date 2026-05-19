import {
  Archive,
  BookMarked,
  ClipboardList,
  FileSearch,
  ChevronDown,
  ChevronUp,
  MessagesSquare,
  PenLine,
  ScrollText,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";

import { useFlowStore, type FlowStepId } from "@/features/flow/flowStore";
import { StepProgress } from "@/features/flow/StepProgress";
import type { FlowStep } from "@/features/flow/flowTypes";
import { StepPost } from "@/pages/workspace/StepPost";
import { StepProfile } from "@/pages/workspace/StepProfile";
import { StepExport } from "@/pages/workspace/StepExport";
import { StepGreeting } from "@/pages/workspace/StepGreeting";
import { StepTrial } from "@/pages/workspace/StepTrial";
import { StepWorld } from "@/pages/workspace/StepWorld";
import { WorkspaceLayout } from "@/shared/layout/WorkspaceLayout";

const steps: FlowStep[] = [
  { id: "post", label: "岛民便笺", description: "写下你记得的 TA。", icon: PenLine },
  { id: "questionnaire", label: "登岛小问卷", description: "先确认几个创作方向。", icon: ClipboardList },
  { id: "profile", label: "认识岛民", description: "从几种可能里靠近 TA 的样子。", icon: FileSearch },
  { id: "world", label: "小岛背景", description: "整理 TA 所在的世界。", icon: BookMarked },
  { id: "greeting", label: "初次招呼", description: "生成第一次见面的场景。", icon: MessagesSquare },
  { id: "trial", label: "相处测试", description: "测试角色一致性。", icon: ScrollText },
  { id: "export", label: "带 TA 回来（导出）", description: "生成角色卡记录。", icon: Archive },
];

function resolveStepId(step: string | undefined): FlowStepId {
  const matched = steps.find((item) => item.id === step);
  return matched?.id ?? "post";
}

export function WorkspacePage() {
  const { projectId, step } = useParams();
  const currentStepId = resolveStepId(step);
  const { completedStepIds, setCurrentStep } = useFlowStore();
  const [isMobileStepNavOpen, setIsMobileStepNavOpen] = useState(false);

  useEffect(() => {
    setCurrentStep(currentStepId);
  }, [currentStepId, setCurrentStep]);

  useEffect(() => {
    setIsMobileStepNavOpen(false);
  }, [currentStepId]);

  if (step === "questionnaire-loading") {
    return <Navigate to={`/questionnaire-loading/${projectId ?? "current"}`} replace />;
  }

  if (currentStepId === "questionnaire") {
    return <Navigate to={`/questionnaire/${projectId ?? "current"}`} replace />;
  }

  const shouldShowStepNav = currentStepId !== "post";

  return (
    <WorkspaceLayout>
      {shouldShowStepNav && (
        <div className="border-b-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.58)] px-4 py-3 lg:hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] px-4 py-3 text-left shadow-[0_3px_0_0_var(--animal-shadow-input)] transition-all hover:-translate-y-0.5"
            onClick={() => setIsMobileStepNavOpen((current) => !current)}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--animal-text-muted)]">
                小岛流程
              </p>
              <p className="mt-1 truncate text-sm font-black text-[var(--animal-text)]">
                当前在「{steps.find((item) => item.id === currentStepId)?.label ?? "未知步骤"}」
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-black text-[var(--animal-primary-active)]">
              <span>{isMobileStepNavOpen ? "收起" : "展开"}</span>
              {isMobileStepNavOpen ? (
                <ChevronUp aria-hidden="true" size={16} />
              ) : (
                <ChevronDown aria-hidden="true" size={16} />
              )}
            </div>
          </button>
          <AnimatePresence initial={false}>
            {isMobileStepNavOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 max-h-[42vh] overflow-auto rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.5)] p-3 shadow-[0_4px_10px_rgba(107,92,67,0.2)]">
                  <StepProgress
                    steps={steps}
                    currentStepId={currentStepId}
                    completedStepIds={completedStepIds}
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      )}
      <div
        className={
          shouldShowStepNav
            ? "grid min-h-[calc(100vh-9rem)] gap-0 lg:grid-cols-[236px_minmax(0,1fr)]"
            : "min-h-[calc(100vh-9rem)]"
        }
      >
        {shouldShowStepNav && (
          <aside className="hidden border-b-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.5)] p-4 lg:block lg:border-b-0 lg:border-r-2">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[var(--animal-text-muted)]">
              小岛流程
            </p>
            <StepProgress
              steps={steps}
              currentStepId={currentStepId}
              completedStepIds={completedStepIds}
            />
          </aside>
        )}
        <AnimatePresence mode="wait">
          <motion.section
            key={currentStepId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
            className="min-h-[calc(100vh-9rem)]"
          >
            {currentStepId === "post" ? (
              <StepPost />
            ) : currentStepId === "profile" ? (
              <StepProfile />
            ) : currentStepId === "world" ? (
              <StepWorld />
            ) : currentStepId === "greeting" ? (
              <StepGreeting />
            ) : currentStepId === "trial" ? (
              <StepTrial />
            ) : currentStepId === "export" ? (
              <StepExport />
            ) : (
              <FutureStep stepId={currentStepId} />
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </WorkspaceLayout>
  );
}

function FutureStep({ stepId }: { stepId: FlowStepId }) {
  const step = steps.find((item) => item.id === stepId)!;
  const Icon = step.icon;

  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-16">
      <article className="w-full max-w-2xl rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-8 shadow-[0_4px_10px_rgba(107,92,67,0.3)]">
        <Icon aria-hidden="true" size={28} className="text-[var(--animal-primary)]" />
        <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[var(--animal-text-muted)]">
          后续阶段入口
        </p>
        <h1 className="mt-4 font-display text-4xl font-black text-[var(--animal-text)]">
          {step.label}
        </h1>
        <p className="mt-4 font-mono text-sm leading-7 text-[var(--animal-text-muted)]">
          阶段 1 先完成路由、布局、面板状态与切换动效。该业务步骤会在对应阶段接入真实交互。
        </p>
      </article>
    </div>
  );
}

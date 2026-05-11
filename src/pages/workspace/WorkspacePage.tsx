import {
  Archive,
  BookMarked,
  FileSearch,
  MessagesSquare,
  PenLine,
  ScrollText,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useParams } from "react-router";

import { useFlowStore, type FlowStepId } from "@/features/flow/flowStore";
import { StepProgress } from "@/features/flow/StepProgress";
import type { FlowStep } from "@/features/flow/flowTypes";
import { StepPost } from "@/pages/workspace/StepPost";
import { StepProfile } from "@/pages/workspace/StepProfile";
import { StepGreeting } from "@/pages/workspace/StepGreeting";
import { StepTrial } from "@/pages/workspace/StepTrial";
import { StepWorld } from "@/pages/workspace/StepWorld";
import { WorkspaceLayout } from "@/shared/layout/WorkspaceLayout";

const steps: FlowStep[] = [
  { id: "post", label: "寻人启事", description: "描述脑海中的角色。", icon: PenLine },
  { id: "profile", label: "辨认轮廓", description: "从几道轮廓里认出 TA 的样子。", icon: FileSearch },
  { id: "world", label: "世界书", description: "整理角色所处世界。", icon: BookMarked },
  { id: "greeting", label: "开场白", description: "生成初次接触场景。", icon: MessagesSquare },
  { id: "trial", label: "终审", description: "测试角色一致性。", icon: ScrollText },
  { id: "export", label: "带 TA 回来（导出）", description: "生成角色卡档案。", icon: Archive },
];

function resolveStepId(step: string | undefined): FlowStepId {
  const matched = steps.find((item) => item.id === step);
  return matched?.id ?? "post";
}

export function WorkspacePage() {
  const { step } = useParams();
  const currentStepId = resolveStepId(step);
  const { completedStepIds, setCurrentStep } = useFlowStore();

  useEffect(() => {
    setCurrentStep(currentStepId);
  }, [currentStepId, setCurrentStep]);

  const shouldShowStepNav = currentStepId !== "post";

  return (
    <WorkspaceLayout>
      <div
        className={
          shouldShowStepNav
            ? "grid min-h-[calc(100vh-9rem)] gap-0 lg:grid-cols-[236px_minmax(0,1fr)]"
            : "min-h-[calc(100vh-9rem)]"
        }
      >
        {shouldShowStepNav && (
          <aside className="border-b border-[var(--echo-line)] bg-[rgba(2,16,24,0.42)] p-4 lg:border-b-0 lg:border-r">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
              档案流程
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
      <article className="w-full max-w-2xl border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-8 shadow-[8px_8px_0_var(--echo-shadow)]">
        <Icon aria-hidden="true" size={28} className="text-[var(--echo-paper)]" />
        <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
          后续阶段入口
        </p>
        <h1 className="mt-4 font-display text-4xl font-black text-[var(--echo-paper)]">
          {step.label}
        </h1>
        <p className="mt-4 font-mono text-sm leading-7 text-[var(--echo-muted)]">
          阶段 1 先完成路由、布局、面板状态与切换动效。该业务步骤会在对应阶段接入真实交互。
        </p>
      </article>
    </div>
  );
}

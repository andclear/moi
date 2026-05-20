import { CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { historyService } from "@/db/services/historyService";
import { projectService } from "@/db/services/projectService";
import type { Project } from "@/db/types";
import { BeautificationLab } from "@/features/beautification/BeautificationLab";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { EmptyState } from "@/shared/components/EmptyState";
import { Button } from "@/shared/components/ui/button";

export function StepBeautification() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);

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

  async function handleNextStep() {
    if (!project) {
      return;
    }

    const { id, createdAt, ...patch } = {
      ...project,
      currentStep: "trial" as const,
    };
    void createdAt;
    const updatedProject = await projectService.updateProject(id, patch);
    if (updatedProject) {
      await historyService.createSnapshot(updatedProject.id, "完成添加美化阶段");
      markStepCompleted("beautification");
      navigate(`/workspace/${updatedProject.id}/trial`);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 font-mono text-sm text-[var(--echo-muted)]">正在准备美化工作台……</div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <EmptyState title="这里还没有 TA" description="先写下岛民便笺，才能添加美化。" />
      </div>
    );
  }

  return (
    <main className="echo-workspace-page">
      <div className="echo-workspace-inner space-y-6">
        <section className="echo-section-card">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            BEAUTIFICATION
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
            添加美化
          </h1>
          <p className="mt-3 max-w-4xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            为 SillyTavern 生成美化样式。这个步骤可以跳过；保存启用的方案会写入最终角色卡。
          </p>
        </section>

        <BeautificationLab project={project} onProjectChange={setProject} />

        <section className="echo-section-card flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles aria-hidden="true" size={22} className="mt-1 text-[var(--animal-primary)]" />
            <div>
              <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
                美化部分可跳过
              </h2>
              <p className="mt-1 font-mono text-sm leading-7 text-[var(--echo-muted)]">
                测试功能，生成质量不稳定，可跳过。当前已保存 {project.beautifications.length}{" "}
                套美化方案。
              </p>
            </div>
          </div>
          <Button type="button" onClick={() => void handleNextStep()}>
            <CheckCircle2 aria-hidden="true" size={16} />
            进入相处测试
          </Button>
        </section>
      </div>
    </main>
  );
}

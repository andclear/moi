import { MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import type { Project } from "@/db/types";
import { projectService } from "@/db/services/projectService";
import { EmptyState } from "@/shared/components/EmptyState";

export function StepHello() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignored = false;

    async function loadProject() {
      setIsLoading(true);
      const resolvedProject = await projectService.resolveProject(projectId);
      if (!ignored) {
        setProject(resolvedProject ?? null);
        setIsLoading(false);
      }
    }

    void loadProject();
    return () => {
      ignored = true;
    };
  }, [projectId]);

  if (isLoading) {
    return <div className="p-6 font-mono text-sm text-[var(--echo-muted)]">正在准备打招呼……</div>;
  }

  if (!project) {
    return (
      <div className="p-6">
        <EmptyState title="这里还没有 TA" description="先完成终审，才能打个招呼。" />
      </div>
    );
  }

  return (
    <main className="echo-workspace-page">
      <div className="echo-workspace-inner space-y-6">
        <section className="echo-section-card">
          <MessagesSquare aria-hidden="true" size={28} className="text-[var(--animal-primary)]" />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            打个招呼
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
            终审已通过，可以和 TA 见面了
          </h1>
          <p className="mt-3 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            真实首轮聊天会在后续版本接入。当前页面先作为终审后的独立入口。
          </p>
        </section>
      </div>
    </main>
  );
}

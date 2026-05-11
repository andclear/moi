import { Activity, AlertTriangle, Clock, Coins } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { generationRepository } from "@/db/repositories/generationRepository";
import { projectService } from "@/db/services/projectService";
import type { GenerationTask } from "@/db/types";
import { TokenUsageMeter } from "@/shared/components/TokenUsageMeter";

const typeLabels: Record<GenerationTask["type"], string> = {
  profile: "辨认轮廓",
  world: "WorldInfo",
  greeting: "开场白",
  trial_questionnaire: "终审问卷",
  trial_answer: "终审回答",
  beautification: "美化与正则",
  companion: "关系网配角",
  export: "导出",
};

export function AssistantNotesPanel() {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    projectService
      .resolveProject(projectId)
      .then(async (project) => {
        if (!mounted || !project) {
          return;
        }
        setTasks(await generationRepository.listByProject(project.id));
      })
      .catch((loadError: unknown) => {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "读取生成笔记失败。");
        }
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const stats = useMemo(() => {
    return tasks.reduce(
      (total, task) => ({
        tokens: total.tokens + (task.usage?.totalTokens ?? 0),
        duration: total.duration + (task.usage?.durationMs ?? 0),
        failures: total.failures + (task.status === "failed" ? 1 : 0),
      }),
      { tokens: 0, duration: 0, failures: 0 },
    );
  }, [tasks]);

  return (
    <aside className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--echo-line)] p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
          侦探助手笔记
        </p>
        <h2 className="mt-2 font-display text-3xl font-black text-[var(--echo-paper)]">
          生成链路
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs text-[var(--echo-muted)]">
          <div className="border border-[var(--echo-line)] p-2">
            <Coins aria-hidden="true" size={15} />
            <p className="mt-1">{stats.tokens || "未记录"} tokens</p>
          </div>
          <div className="border border-[var(--echo-line)] p-2">
            <Clock aria-hidden="true" size={15} />
            <p className="mt-1">{stats.duration ? `${(stats.duration / 1000).toFixed(1)} 秒` : "未记录"}</p>
          </div>
          <div className="border border-[var(--echo-line)] p-2">
            <AlertTriangle aria-hidden="true" size={15} />
            <p className="mt-1">{stats.failures} 次失败</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {error && (
          <p className="border border-[var(--echo-stamp)] bg-[rgba(120,40,34,0.18)] p-3 font-mono text-sm text-[var(--echo-paper)]">
            {error}
          </p>
        )}
        {tasks.length ? (
          tasks.map((task) => (
            <article key={task.id} className="border border-[var(--echo-line)] bg-[rgba(2,16,24,0.45)] p-3">
              <div className="flex items-start gap-3">
                <Activity aria-hidden="true" size={18} className="mt-1 text-[var(--echo-paper)]" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-[var(--echo-paper)]">
                    {typeLabels[task.type]} · {task.status}
                  </p>
                  <p className="mt-1 break-words font-mono text-xs leading-5 text-[var(--echo-muted)]">
                    {task.inputSummary}
                  </p>
                  <div className="mt-2">
                    <TokenUsageMeter task={task} />
                  </div>
                  {task.errorMessage && (
                    <p className="mt-2 font-mono text-xs leading-5 text-[var(--echo-stamp)]">
                      {task.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="border border-dashed border-[var(--echo-line)] p-4 font-mono text-sm text-[var(--echo-muted)]">
            还没有生成记录。每一次模型调用都会在这里留下时间、来源、消耗和错误摘要。
          </p>
        )}
      </div>
    </aside>
  );
}

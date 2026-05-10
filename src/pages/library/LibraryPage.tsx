import { FileArchive, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { projectService } from "@/db/services/projectService";
import type { Project } from "@/db/types";
import { Button } from "@/shared/components/ui/button";

export function LibraryPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let mounted = true;

    projectService.listActiveProjects().then((items) => {
      if (mounted) {
        setProjects(items);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
            本地档案库
          </p>
          <h1 className="mt-3 font-display text-3xl font-black text-[var(--echo-paper)]">
            我的 TA 的回音
          </h1>
        </div>
        <Button asChild>
          <Link to="/workspace">
            <Plus aria-hidden="true" size={18} />
            寻找新的回音
          </Link>
        </Button>
      </div>
      {projects.length > 0 ? (
        <div className="mt-8 grid gap-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/workspace/${project.id}/${project.currentStep}`}
              className="border border-[var(--echo-line)] bg-[rgba(2,16,24,0.34)] p-4 transition-colors hover:border-[var(--echo-paper)]"
            >
              <p className="font-display text-xl font-black text-[var(--echo-paper)]">
                {project.title}
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--echo-muted)]">
                当前阶段：{project.currentStep}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 flex min-h-72 flex-col items-center justify-center border border-dashed border-[var(--echo-line)] text-center">
          <FileArchive aria-hidden="true" size={40} className="text-[var(--echo-muted)]" />
          <p className="mt-4 font-bold text-[var(--echo-paper)]">还没有被寻回的 TA</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--echo-muted)]">
            阶段 2 会接入 Dexie 本地数据库，创建、复制、删除和重新导出档案都会从这里开始。
          </p>
        </div>
      )}
    </section>
  );
}

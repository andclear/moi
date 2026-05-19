import { ClipboardList } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";

import { AnimalIcon } from "@/shared/components/AnimalIcon";

const QUESTIONNAIRE_LOADING_DURATION_MS = 2000;

export function StepQuestionnaireLoading() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate(`/workspace/${projectId ?? "current"}/questionnaire`, { replace: true });
    }, QUESTIONNAIRE_LOADING_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [navigate, projectId]);

  return (
    <main className="flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-16">
      <section
        className="w-full max-w-xl rounded-[34px] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-7 text-center shadow-[0_8px_0_0_var(--animal-shadow-input)] sm:p-10"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] shadow-[0_5px_0_0_var(--animal-primary-active)]">
          <div className="relative h-16 w-16">
            <span className="absolute inset-0 rounded-full border-4 border-[rgba(25,200,185,0.24)]" />
            <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--animal-primary)] border-r-[var(--animal-warning)]" />
            <AnimalIcon
              name="icon-map"
              size={28}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--animal-text)]"
            />
          </div>
        </div>
        <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-stamp)]">
          登岛准备中
        </p>
        <h1 className="mt-3 font-display text-4xl font-black text-[var(--animal-text)]">
          正在领取登岛小问卷
        </h1>
        <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2 font-mono text-sm leading-7 text-[var(--animal-text-muted)]">
          <ClipboardList aria-hidden="true" size={18} className="shrink-0 text-[var(--animal-primary)]" />
          岛务处正在准备几个小问题，马上就能继续。
        </p>
      </section>
    </main>
  );
}

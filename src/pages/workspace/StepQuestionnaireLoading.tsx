import { Loading } from "animal-island-ui";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

const QUESTIONNAIRE_LOADING_DURATION_MS = 2000;
const QUESTIONNAIRE_LOADING_REVEAL_MS = 420;

export function StepQuestionnaireLoading() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [active, setActive] = useState(true);

  useEffect(() => {
    const revealTimer = window.setTimeout(() => {
      setActive(false);
    }, Math.max(0, QUESTIONNAIRE_LOADING_DURATION_MS - QUESTIONNAIRE_LOADING_REVEAL_MS));
    const navigateTimer = window.setTimeout(() => {
      navigate(`/questionnaire/${projectId ?? "current"}`, { replace: true });
    }, QUESTIONNAIRE_LOADING_DURATION_MS);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(navigateTimer);
    };
  }, [navigate, projectId]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--animal-bg)]">
      <div className="absolute inset-0 flex items-center justify-center px-4 py-12">
        <section className="w-full max-w-3xl rounded-[34px] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-7 shadow-[0_8px_0_0_var(--animal-shadow-input)] sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-stamp)]">
            登岛小问卷
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-[var(--animal-text)]">
            问卷纸正在铺开
          </h1>
          <div className="mt-8 grid gap-4">
            <span className="h-5 w-3/5 rounded-full bg-[rgba(159,146,125,0.22)]" />
            <span className="h-5 w-4/5 rounded-full bg-[rgba(159,146,125,0.16)]" />
            <span className="h-5 w-2/3 rounded-full bg-[rgba(159,146,125,0.16)]" />
          </div>
        </section>
      </div>
      <Loading active={active} style={{ position: "absolute", inset: 0, height: "100%" }} />
    </main>
  );
}

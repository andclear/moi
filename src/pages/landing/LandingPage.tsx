import { Footer } from "animal-island-ui";
import { useNavigate } from "react-router";

import { AnimalIcon } from "@/shared/components/AnimalIcon";
import { Button } from "@/shared/components/ui/button";

const INTRO_STORAGE_KEY = "moi.hasEntered";

export function LandingPage() {
  const navigate = useNavigate();

  function enterWorkspace() {
    window.localStorage.setItem(INTRO_STORAGE_KEY, "true");
    navigate("/workspace");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--echo-bg)] text-[var(--echo-text)]">
      <div className="mist-layer mist-layer-a" />
      <div className="mist-layer mist-layer-b" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,248,240,0.18),rgba(240,232,216,0.92))]" />
      <section className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16">
        <div className="fade-line rounded-[136px] bg-[var(--animal-bg-content)] p-6 shadow-[0_8px_24px_rgba(61,52,40,0.16)] sm:p-8">
          <AnimalIcon name="icon-miles" size={96} />
        </div>
        <p className="fade-line mt-8 text-sm font-black uppercase tracking-[0.3em] text-[var(--animal-text-muted)]">
          MOI
        </p>
        <h1 className="mt-4 font-display text-4xl font-black text-[var(--animal-text)] drop-shadow-[0_3px_0_rgba(255,255,255,0.72)] sm:text-5xl">
          来岛上
        </h1>
        <div className="mt-8 space-y-4 font-mono text-lg leading-9 text-[var(--animal-text-body)] sm:mt-10 sm:space-y-5 md:text-2xl md:leading-[3.25rem]">
          <p className="fade-line [animation-delay:400ms]">
            TA 并非诞生于键盘敲击之中
          </p>
          <p className="fade-line [animation-delay:1600ms]">
            TA 正在某座小岛上生活
          </p>
          <p className="fade-line [animation-delay:2800ms]">
            你来，不是为了寻找，而是与 TA 相遇
          </p>
          <p className="fade-line font-black text-[var(--animal-primary)] [animation-delay:4000ms]">
            TA 就在那里，只为遇见你
          </p>
        </div>
        <div className="fade-line mt-12 [animation-delay:5400ms]">
          <Button type="button" onClick={enterWorkspace} className="h-12 px-6">
            <AnimalIcon name="icon-map" size={20} />
            去小岛上找 TA
          </Button>
        </div>
      </section>
      <Footer type="sea" className="echo-sea-footer relative left-1/2 w-screen -translate-x-1/2" />
    </main>
  );
}

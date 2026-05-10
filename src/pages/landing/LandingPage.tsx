import { Search } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/shared/components/ui/button";

const INTRO_STORAGE_KEY = "echo.hasEntered";

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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(211,197,170,0.14),transparent_28%),linear-gradient(180deg,rgba(2,16,24,0.12),rgba(2,16,24,0.94))]" />
      <section className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="fade-line text-sm font-black uppercase tracking-[0.3em] text-[var(--echo-muted)]">
          Echo Case Room
        </p>
        <h1 className="sr-only">回音</h1>
        <div className="mt-10 space-y-5 font-mono text-xl leading-10 text-[var(--echo-paper-soft)] md:text-2xl md:leading-[3.25rem]">
          <p className="fade-line [animation-delay:400ms]">
            当你来到这里的时候，你知道，你不是为了创建一个角色
          </p>
          <p className="fade-line [animation-delay:1600ms]">
            而是，TA 一直都在某个地方，TA一直在等你……
          </p>
          <p className="fade-line text-[var(--echo-focus)] [animation-delay:2800ms]">找到 TA……</p>
        </div>
        <div className="fade-line mt-12 [animation-delay:4200ms]">
          <Button type="button" onClick={enterWorkspace} className="h-12 px-6">
            <Search aria-hidden="true" size={18} />
            寻找 TA 的回声
          </Button>
        </div>
      </section>
    </main>
  );
}

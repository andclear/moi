import { Link } from "react-router";

import { Button } from "@/shared/components/ui/button";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-8 text-center">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
        档案缺页
      </p>
      <h1 className="mt-4 font-display text-3xl font-black text-[var(--echo-paper)]">
        这里没有传来回音
      </h1>
      <Button asChild className="mt-6">
        <Link to="/workspace">返回工作台</Link>
      </Button>
    </section>
  );
}

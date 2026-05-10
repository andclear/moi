import { LockKeyhole } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

export function AdminLoginPage() {
  return (
    <section className="mx-auto max-w-lg border-2 border-[var(--echo-line)] bg-[var(--echo-paper)] p-8 text-[var(--echo-ink)] shadow-[8px_8px_0_var(--echo-shadow)]">
      <LockKeyhole aria-hidden="true" size={28} />
      <h1 className="mt-5 font-display text-3xl font-black">后台登录</h1>
      <p className="mt-4 font-mono text-sm leading-6">
        未登录管理员访问 /admin 时会进入此登录页。真实认证、会话和审计日志将在后续服务端阶段实现。
      </p>
      <form className="mt-6 space-y-5">
        <label className="block text-sm font-black uppercase tracking-[0.12em]" htmlFor="admin-password">
          管理员口令
        </label>
        <input
          id="admin-password"
          type="password"
          className="w-full border-0 border-b-2 border-[var(--echo-ink)] bg-transparent py-2 font-mono outline-none"
          placeholder="等待接入服务端认证"
        />
        <Button type="button">进入后台</Button>
      </form>
    </section>
  );
}

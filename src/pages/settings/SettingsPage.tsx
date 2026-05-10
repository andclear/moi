import { KeyRound, Server } from "lucide-react";

export function SettingsPage() {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <article className="border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-6">
        <Server aria-hidden="true" size={24} className="text-[var(--echo-paper)]" />
        <h1 className="mt-4 font-display text-3xl font-black text-[var(--echo-paper)]">
          API 与模型设置
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--echo-muted)]">
          阶段 4 会在这里保存 OpenAI 兼容接口、模型名称、温度和 system prompt 兼容配置。
        </p>
      </article>
      <article className="border-2 border-[var(--echo-line)] bg-[var(--echo-paper)] p-6 text-[var(--echo-ink)]">
        <KeyRound aria-hidden="true" size={24} />
        <h2 className="mt-4 font-display text-2xl font-black">预置调用激活</h2>
        <p className="mt-4 font-mono text-sm leading-6">
          预置调用模式必须经过服务端校验。阶段 0 只保留入口，避免在浏览器中暴露任何真实服务密钥。
        </p>
      </article>
    </section>
  );
}

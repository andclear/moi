import { BookOpen, FileArchive, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router";

import { PageTransition } from "@/shared/layout/PageTransition";
import { cn } from "@/shared/lib/utils";

const navItems = [
  { to: "/workspace", label: "工作台", icon: BookOpen },
  { to: "/library", label: "档案库", icon: FileArchive },
  { to: "/settings", label: "设置", icon: Settings },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-[var(--echo-bg)] text-[var(--echo-text)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(211,197,170,0.08),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.04)_0,transparent_38%)]" />
      <header className="sticky top-0 z-40 border-b border-[var(--echo-line)] bg-[rgba(2,16,24,0.9)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <NavLink to="/workspace" className="group flex items-baseline gap-3">
            <span className="font-display text-2xl font-black tracking-normal text-[var(--echo-paper)]">
              回音
            </span>
          </NavLink>
          <nav className="flex items-center gap-2" aria-label="主导航">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex h-10 cursor-pointer items-center gap-2 border px-3 text-sm font-bold transition-colors",
                      isActive
                        ? "border-[var(--echo-paper)] bg-[var(--echo-paper)] text-[var(--echo-ink)]"
                        : "border-[var(--echo-line)] bg-[var(--echo-panel)] text-[var(--echo-muted)] hover:text-[var(--echo-text)]",
                    )
                  }
                >
                  <Icon aria-hidden="true" size={16} />
                  <span className="hidden sm:inline">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="relative mx-auto max-w-7xl px-6 py-8">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}

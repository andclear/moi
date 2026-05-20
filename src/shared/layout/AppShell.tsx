import type { IconName } from "animal-island-ui";
import { Footer } from "animal-island-ui";
import { Settings, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet } from "react-router";

import { useModelChannelStore } from "@/features/activation/modelChannelStore";
import { AnimalIcon } from "@/shared/components/AnimalIcon";
import { PageTransition } from "@/shared/layout/PageTransition";
import { cn } from "@/shared/lib/utils";

type NavItem =
  | { to: string; label: string; animalIcon: IconName; icon?: never }
  | { to: string; label: string; icon: LucideIcon; animalIcon?: never };

const navItems: NavItem[] = [
  { to: "/workspace", label: "工作台", animalIcon: "icon-map" },
  { to: "/library", label: "岛民册", animalIcon: "icon-critterpedia" },
  { to: "/settings", label: "设置", icon: Settings },
];

export function AppShell() {
  const loadModelChannel = useModelChannelStore((state) => state.load);

  useEffect(() => {
    void loadModelChannel();
  }, [loadModelChannel]);

  return (
    <div className="min-h-screen bg-[var(--echo-bg)] text-[var(--echo-text)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(130,213,187,0.24),transparent_30%),radial-gradient(circle_at_86%_8%,rgba(247,205,103,0.22),transparent_24%)]" />
      <header className="sticky top-0 z-40 border-b-2 border-[var(--animal-border)] bg-[rgba(255,252,244,0.9)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <NavLink to="/workspace" className="group flex items-center gap-3">
            <AnimalIcon name="icon-miles" size={34} />
            <span className="font-display text-2xl font-black tracking-normal text-[var(--animal-text)]">
              来岛上
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
                      "flex h-10 cursor-pointer items-center gap-2 rounded-[var(--animal-radius-sm)] border-2 px-3 text-sm font-bold transition-all duration-150",
                      isActive
                        ? "border-[var(--animal-sidebar-active)] bg-[var(--animal-sidebar-active)] text-white shadow-[0_3px_0_0_var(--animal-shadow-input)]"
                        : "border-transparent bg-transparent text-[var(--animal-text-muted)] hover:bg-[var(--animal-sidebar-hover)] hover:text-[var(--animal-text)]",
                    )
                  }
                >
                  {item.animalIcon ? (
                    <AnimalIcon name={item.animalIcon} size={18} />
                  ) : Icon ? (
                    <Icon aria-hidden="true" size={16} />
                  ) : null}
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
      <Footer type="sea" className="echo-sea-footer relative left-1/2 mt-6 w-screen -translate-x-1/2" />
    </div>
  );
}

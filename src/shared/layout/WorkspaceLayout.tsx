import { AnimatePresence, motion } from "framer-motion";
import { Server, UserRoundCog, X } from "lucide-react";
import type { PropsWithChildren } from "react";

import { ApiStatusBadge } from "@/features/activation/ApiStatusBadge";
import { ApiStatusPanel } from "@/features/activation/ApiStatusPanel";
import { DossierPanel } from "@/features/dossier/DossierPanel";
import { useUiStore } from "@/features/ui/uiStore";
import { Button } from "@/shared/components/ui/button";

export function WorkspaceLayout({ children }: PropsWithChildren) {
  const { activePanel, isSidebarOpen, closePanel, openPanel } = useUiStore();

  return (
    <div className="relative min-h-[calc(100vh-9rem)] overflow-hidden rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[rgba(247,243,223,0.78)] shadow-[0_8px_24px_0_rgba(61,52,40,0.12)]">
      <div className="border-b-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.46)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ApiStatusBadge />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="查看 API 状态"
            onClick={() => openPanel("api")}
          >
            <Server aria-hidden="true" size={18} />
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="echo-dossier-button-ripple min-w-[9.5rem] px-6"
            aria-label="打开岛民档案"
            onClick={() => openPanel("dossier")}
          >
            <UserRoundCog aria-hidden="true" size={18} />
            岛民档案
          </Button>
        </div>
      </div>
      <div className="min-h-[calc(100vh-9rem)]">
        {children}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.button
                type="button"
                aria-label="点击空白处关闭侧边抽屉"
                className="fixed inset-0 z-30 cursor-default bg-[rgba(114,93,66,0.28)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={closePanel}
              />
              <motion.div
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 32 }}
                transition={{ duration: 0.22 }}
                className="fixed inset-y-0 right-0 z-40 w-[min(96vw,50vw)] min-w-[min(96vw,380px)] border-l-2 border-[var(--animal-border)] shadow-[-12px_0_24px_rgba(61,52,40,0.14)]"
              >
                <div className="flex h-full flex-col bg-[var(--animal-bg-content)]">
                  <div className="flex justify-end border-b-2 border-[var(--animal-border)] p-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={closePanel}
                      aria-label="关闭侧边抽屉"
                    >
                      <X aria-hidden="true" size={18} />
                    </Button>
                  </div>
                  {activePanel === "api" ? <ApiStatusPanel /> : <DossierPanel />}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

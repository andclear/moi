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
    <div className="relative min-h-[calc(100vh-9rem)] overflow-hidden border border-[var(--echo-line)] bg-[rgba(2,16,24,0.42)] shadow-[inset_0_0_0_1px_rgba(211,197,170,0.06)]">
      <div className="absolute right-4 top-4 z-20 flex flex-wrap justify-end gap-2">
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
          size="icon"
          variant="secondary"
          aria-label="打开 TA 的回音"
          onClick={() => openPanel("dossier")}
        >
          <UserRoundCog aria-hidden="true" size={18} />
        </Button>
      </div>
      <div className="min-h-[calc(100vh-9rem)]">
        {children}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.button
                type="button"
                aria-label="点击空白处关闭侧边抽屉"
                className="fixed inset-0 z-30 cursor-default bg-[rgba(2,16,24,0.34)]"
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
                className="fixed inset-y-0 right-0 z-40 w-[min(92vw,380px)] border-l border-[var(--echo-line)] shadow-[-14px_0_0_rgba(2,16,24,0.36)]"
              >
                <div className="flex h-full flex-col bg-[rgba(18,33,42,0.98)]">
                  <div className="flex justify-end border-b border-[var(--echo-line)] p-3">
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

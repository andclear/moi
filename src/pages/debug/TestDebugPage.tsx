import { Bug, Copy, Database, FileText, RefreshCw, Search } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

import type { GenerationTask, Project } from "@/db/types";
import { generationRepository } from "@/db/repositories/generationRepository";
import { projectRepository } from "@/db/repositories/projectRepository";
import {
  buildDebugProjectSnapshot,
  sanitizeDebugValue,
  type DebugPromptPreview,
  type DebugVariable,
} from "@/features/debug/promptDebug";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

type DebugTab = "variables" | "prompts" | "storage" | "generations";

function stringify(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(sanitizeDebugValue(value), null, 2);
}

function getPreviewText(value: unknown) {
  const text = stringify(value);
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

export function TestDebugPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [generations, setGenerations] = useState<GenerationTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DebugTab>("variables");
  const [searchText, setSearchText] = useState("");

  async function loadData(nextProjectId?: string) {
    setIsLoading(true);
    const loadedProjects = await projectRepository.listAll();
    const projectId = nextProjectId || selectedProjectId || loadedProjects[0]?.id || "";
    const selectedProject = loadedProjects.find((project) => project.id === projectId);
    const loadedGenerations = selectedProject
      ? await generationRepository.listByProject(selectedProject.id)
      : [];

    setProjects(loadedProjects);
    setSelectedProjectId(projectId);
    setGenerations(loadedGenerations.slice(0, 30));
    setIsLoading(false);
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const snapshot = useMemo(
    () => (selectedProject ? buildDebugProjectSnapshot(selectedProject, generations) : null),
    [selectedProject, generations],
  );

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredVariables = useMemo(() => {
    if (!snapshot || !normalizedSearch) {
      return snapshot?.variables ?? [];
    }

    return snapshot.variables.filter((variable) =>
      [
        variable.name,
        variable.label,
        variable.usedBy.join(" "),
        stringify(variable.value).slice(0, 5000),
      ]
        .join("\n")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [normalizedSearch, snapshot]);

  const filteredPrompts = useMemo(() => {
    if (!snapshot || !normalizedSearch) {
      return snapshot?.promptPreviews ?? [];
    }

    return snapshot.promptPreviews.filter((prompt) =>
      [
        prompt.title,
        prompt.description,
        prompt.variables.join(" "),
        stringify(prompt.messagesWithGlobalPrompt).slice(0, 12000),
      ]
        .join("\n")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [normalizedSearch, snapshot]);

  return (
    <main className="min-h-screen bg-[var(--animal-bg)] px-4 py-6 text-[var(--animal-text-body)] lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <section className="rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-5 shadow-[0_4px_10px_rgba(107,92,67,0.3)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-primary)] shadow-[0_3px_0_0_var(--animal-shadow-input)]">
                  <Bug aria-hidden="true" size={22} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--animal-text-muted)]">
                    Prompt Debug
                  </p>
                  <h1 className="font-display text-3xl font-black text-[var(--animal-text)]">
                    /test 调试页面
                  </h1>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-[var(--animal-text-muted)]">
                这里展示当前角色卡的原始存储、prompt 变量解析结果、实际 prompt
                预览以及最近生成记录。用于排查 WorldInfo、开场白、聊天记录等变量是否真实进入提示词。
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
              <label className="flex min-w-[280px] flex-col gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--animal-text-muted)]">
                选择角色卡
                <select
                  className="h-11 rounded-[var(--animal-radius-base)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg)] px-3 text-sm font-bold normal-case tracking-normal text-[var(--animal-text)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none focus:border-[var(--animal-primary)]"
                  value={selectedProjectId}
                  onChange={(event) => void loadData(event.target.value)}
                >
                  {projects.length ? (
                    projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title} · {project.id}
                      </option>
                    ))
                  ) : (
                    <option value="">暂无角色卡</option>
                  )}
                </select>
              </label>
              <Button
                type="button"
                variant="secondary"
                className="self-end"
                loading={isLoading}
                onClick={() => void loadData()}
              >
                <RefreshCw aria-hidden="true" size={18} />
                刷新数据
              </Button>
            </div>
          </div>
        </section>

        {!selectedProject || !snapshot ? (
          <EmptyDebugState isLoading={isLoading} />
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {snapshot.diagnostics.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[var(--animal-radius-base)] border-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.55)] p-4 shadow-[0_3px_0_0_var(--animal-shadow-input)]"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--animal-text-muted)]">
                    {item.title}
                  </p>
                  <p className="mt-3 text-base font-black leading-7 text-[var(--animal-text)]">
                    {item.value}
                  </p>
                </article>
              ))}
            </section>

            <section className="rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-4 shadow-[0_4px_10px_rgba(107,92,67,0.3)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <TabButton active={activeTab === "variables"} onClick={() => setActiveTab("variables")}>
                    <Search aria-hidden="true" size={17} />
                    变量总表
                  </TabButton>
                  <TabButton active={activeTab === "prompts"} onClick={() => setActiveTab("prompts")}>
                    <FileText aria-hidden="true" size={17} />
                    Prompt 预览
                  </TabButton>
                  <TabButton active={activeTab === "storage"} onClick={() => setActiveTab("storage")}>
                    <Database aria-hidden="true" size={17} />
                    存储状态
                  </TabButton>
                  <TabButton
                    active={activeTab === "generations"}
                    onClick={() => setActiveTab("generations")}
                  >
                    <Database aria-hidden="true" size={17} />
                    生成记录
                  </TabButton>
                </div>

                <label className="relative block min-w-0 lg:w-[420px]">
                  <Search
                    aria-hidden="true"
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--animal-text-muted)]"
                  />
                  <input
                    className="h-11 w-full rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg)] pl-10 pr-4 text-sm font-bold text-[var(--animal-text)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none placeholder:text-[var(--animal-text-disabled)] focus:border-[var(--animal-primary)]"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="搜索变量、WorldInfo、statusblock、prompt..."
                  />
                </label>
              </div>
            </section>

            {activeTab === "variables" ? <VariablesPanel variables={filteredVariables} /> : null}
            {activeTab === "prompts" ? <PromptsPanel prompts={filteredPrompts} /> : null}
            {activeTab === "storage" ? (
              <StoragePanel sections={snapshot.storageSections} searchText={normalizedSearch} />
            ) : null}
            {activeTab === "generations" ? (
              <StoragePanel
                sections={generations.map((generation) => ({
                  id: generation.id,
                  title: `${generation.type} · ${generation.status} · ${generation.inputSummary}`,
                  value: generation,
                }))}
                searchText={normalizedSearch}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function EmptyDebugState({ isLoading }: { isLoading: boolean }) {
  return (
    <section className="rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-8 text-center shadow-[0_4px_10px_rgba(107,92,67,0.3)]">
      <p className="font-display text-2xl font-black text-[var(--animal-text)]">
        {isLoading ? "正在读取本地数据..." : "还没有可调试的角色卡"}
      </p>
      <p className="mt-3 text-sm font-bold text-[var(--animal-text-muted)]">
        创建角色卡后，回到这里就能查看所有变量和 prompt 内容。
      </p>
    </section>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-[var(--animal-radius-pill)] border-2 px-4 text-sm font-black shadow-[0_3px_0_0_var(--animal-shadow-input)] transition-all",
        active
          ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-primary)]"
          : "border-[var(--animal-border)] bg-[var(--animal-bg)] text-[var(--animal-text-muted)] hover:border-[var(--animal-primary)]",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function VariablesPanel({ variables }: { variables: DebugVariable[] }) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {variables.map((variable) => (
        <article
          key={variable.name}
          className="overflow-hidden rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] shadow-[0_4px_10px_rgba(107,92,67,0.22)]"
        >
          <div className="border-b-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.5)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--animal-text-muted)]">
                  {variable.name}
                </p>
                <h2 className="mt-1 text-xl font-black text-[var(--animal-text)]">
                  {variable.label}
                </h2>
              </div>
              <CopyButton value={stringify(variable.value)} />
            </div>
            <p className="mt-3 text-xs font-bold leading-6 text-[var(--animal-text-muted)]">
              使用位置：{variable.usedBy.length ? variable.usedBy.join("、") : "仅存储状态"}
            </p>
          </div>
          <CodeBlock value={stringify(variable.value)} maxHeightClass="max-h-[420px]" />
        </article>
      ))}
    </section>
  );
}

function PromptsPanel({ prompts }: { prompts: DebugPromptPreview[] }) {
  return (
    <section className="flex flex-col gap-4">
      {prompts.map((prompt) => (
        <article
          key={prompt.id}
          className="overflow-hidden rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] shadow-[0_4px_10px_rgba(107,92,67,0.22)]"
        >
          <div className="border-b-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.5)] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--animal-text-muted)]">
                  {prompt.id}
                </p>
                <h2 className="mt-1 text-xl font-black text-[var(--animal-text)]">
                  {prompt.title}
                </h2>
                <p className="mt-2 text-sm font-bold leading-7 text-[var(--animal-text-muted)]">
                  {prompt.description}
                </p>
                <p className="mt-2 text-xs font-bold leading-6 text-[var(--animal-text-muted)]">
                  变量：{prompt.variables.join("、")}
                </p>
              </div>
              <CopyButton value={stringify(prompt.messagesWithGlobalPrompt)} />
            </div>
          </div>
          <CodeBlock value={stringify(prompt.messagesWithGlobalPrompt)} maxHeightClass="max-h-[620px]" />
        </article>
      ))}
    </section>
  );
}

function StoragePanel({
  sections,
  searchText,
}: {
  sections: Array<{ id: string; title: string; value: unknown }>;
  searchText: string;
}) {
  const filteredSections = searchText
    ? sections.filter((section) =>
        `${section.title}\n${stringify(section.value).slice(0, 20000)}`
          .toLowerCase()
          .includes(searchText),
      )
    : sections;

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {filteredSections.map((section) => (
        <article
          key={section.id}
          className="overflow-hidden rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] shadow-[0_4px_10px_rgba(107,92,67,0.22)]"
        >
          <div className="border-b-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.5)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--animal-text-muted)]">
                  {section.id}
                </p>
                <h2 className="mt-1 text-xl font-black text-[var(--animal-text)]">
                  {section.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-xs font-bold leading-6 text-[var(--animal-text-muted)]">
                  {getPreviewText(section.value)}
                </p>
              </div>
              <CopyButton value={stringify(section.value)} />
            </div>
          </div>
          <CodeBlock value={stringify(section.value)} maxHeightClass="max-h-[620px]" />
        </article>
      ))}
    </section>
  );
}

function CodeBlock({ value, maxHeightClass }: { value: string; maxHeightClass: string }) {
  return (
    <pre
      className={cn(
        "overflow-auto whitespace-pre-wrap break-words bg-[rgba(255,255,255,0.32)] p-4 font-mono text-xs leading-6 text-[var(--animal-text-body)]",
        maxHeightClass,
      )}
    >
      {value}
    </pre>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopy()}>
      <Copy aria-hidden="true" size={16} />
      {copied ? "已复制" : "复制"}
    </Button>
  );
}

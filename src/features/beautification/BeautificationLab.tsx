import CodeMirror from "@uiw/react-codemirror";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import {
  Check,
  Code2,
  Eye,
  FileJson2,
  Regex,
  Save,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  BeautificationAsset,
  BeautificationGreetingInsertMode,
  Project,
} from "@/db/types";
import {
  applyBeautificationToGreetings,
  createBeautificationAsset,
  createFallbackBeautificationAsset,
  testBeautificationRegex,
} from "@/features/beautification/beautificationStore";
import { projectService } from "@/db/services/projectService";
import { nowIso } from "@/shared/lib/date";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

interface BeautificationLabProps {
  project: Project;
  onProjectChange: (project: Project) => void;
}

function splitCodeForExtensions(value: string) {
  if (value.includes("<style") || value.includes("<script")) {
    return [htmlLanguage()];
  }

  return [htmlLanguage(), javascript({ jsx: true })];
}

function formatWorldInfoJson(asset: BeautificationAsset) {
  return JSON.stringify(asset.worldInfo ?? null, null, 2);
}

function buildPreviewHtml(asset: BeautificationAsset) {
  try {
    const expression = new RegExp(asset.regex, "s");
    const replaced = asset.formattedOriginalText.replace(expression, asset.html);
    return replaced === asset.formattedOriginalText && !expression.test(asset.formattedOriginalText)
      ? asset.html
      : replaced;
  } catch {
    return asset.html;
  }
}

function parseWorldInfoJson(value: string): BeautificationAsset["worldInfo"] {
  const parsed = JSON.parse(value) as BeautificationAsset["worldInfo"];
  if (!parsed) {
    return null;
  }

  return {
    comment: String(parsed.comment ?? "美化格式说明"),
    content: String(parsed.content ?? ""),
    constant: Boolean(parsed.constant),
    keys: Array.isArray(parsed.keys) ? parsed.keys.map(String).filter(Boolean) : [],
    position: Number.isFinite(Number(parsed.position)) ? Number(parsed.position) : 4,
    depth: parsed.depth === "" ? "" : Number.isFinite(Number(parsed.depth)) ? Number(parsed.depth) : 4,
    insertion_order: Number.isFinite(Number(parsed.insertion_order))
      ? Number(parsed.insertion_order)
      : parsed.constant
        ? 999
        : 180,
  };
}

const insertOptions: Array<{ value: BeautificationGreetingInsertMode; label: string; description: string }> = [
  {
    value: "none",
    label: "不插入开场白",
    description: "依靠关键词触发 WorldInfo，适合剧情中后期才出现的美化。",
  },
  {
    value: "primary",
    label: "插入主开场白",
    description: "只追加到主开场白，让状态栏或固定结构从第一轮就出现。",
  },
  {
    value: "all_adopted",
    label: "插入所有已采用开场白",
    description: "备用开场也会带同一段结构化内容。",
  },
];

export function BeautificationLab({ project, onProjectChange }: BeautificationLabProps) {
  const [userRequest, setUserRequest] = useState(
    "生成一套适合当前角色卡的状态栏，包含关系状态、当前位置、情绪和当前目标，并带有可点击展开的视觉效果。",
  );
  const [insertIntoGreeting, setInsertIntoGreeting] =
    useState<BeautificationGreetingInsertMode>("primary");
  const [selectedId, setSelectedId] = useState(project.beautifications?.[0]?.id ?? "");
  const [error, setError] = useState("");
  const [worldInfoJson, setWorldInfoJson] = useState("");
  const [worldInfoError, setWorldInfoError] = useState("");
  const [generationStatus, setGenerationStatus] = useState<
    "idle" | "running" | "succeeded" | "failed"
  >("idle");

  const assets = useMemo(() => project.beautifications ?? [], [project.beautifications]);
  const selectedAsset = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  const regexResult = useMemo(
    () =>
      selectedAsset
        ? testBeautificationRegex(selectedAsset.regex, selectedAsset.formattedOriginalText)
        : undefined,
    [selectedAsset],
  );
  const previewHtml = useMemo(
    () => (selectedAsset ? buildPreviewHtml(selectedAsset) : ""),
    [selectedAsset],
  );

  useEffect(() => {
    const asset = assets.find((item) => item.id === selectedId) ?? assets[0];
    if (asset) {
      setWorldInfoJson(formatWorldInfoJson(asset));
      setWorldInfoError("");
    }
  }, [assets, selectedId]);

  async function persist(nextProject: Project) {
    const { id, createdAt, ...patch } = nextProject;
    void createdAt;
    const saved = await projectService.updateProject(id, patch);
    if (saved) {
      onProjectChange(saved);
    }
    return saved;
  }

  async function addAsset(asset: BeautificationAsset) {
    const nextBaseProject: Project = {
      ...project,
      beautifications: [...assets, asset],
      updatedAt: nowIso(),
    };
    const nextProject = applyBeautificationToGreetings(nextBaseProject, asset);
    setSelectedId(asset.id);
    await persist(nextProject);
  }

  async function handleGenerate() {
    setGenerationStatus("running");
    setError("");
    try {
      const { asset } = await createBeautificationAsset(project, {
        userRequest,
        insertIntoGreeting,
      });
      await addAsset(asset);
      setGenerationStatus("succeeded");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "美化生成失败。");
      setGenerationStatus("failed");
    }
  }

  async function handleFallback() {
    await addAsset(createFallbackBeautificationAsset(project, { userRequest, insertIntoGreeting }));
  }

  async function updateAsset(patch: Partial<BeautificationAsset>) {
    if (!selectedAsset) {
      return;
    }

    const nextAssets = assets.map((asset) =>
      asset.id === selectedAsset.id ? { ...asset, ...patch, updatedAt: nowIso() } : asset,
    );
    await persist({ ...project, beautifications: nextAssets, updatedAt: nowIso() });
  }

  async function saveWorldInfoJson() {
    if (!selectedAsset) {
      return;
    }

    try {
      const worldInfo = parseWorldInfoJson(worldInfoJson);
      setWorldInfoError("");
      await updateAsset({ worldInfo, title: worldInfo?.comment ?? selectedAsset.title });
    } catch (parseError) {
      setWorldInfoError(parseError instanceof Error ? parseError.message : "WorldInfo JSON 格式不正确。");
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <aside className="echo-side-panel h-fit space-y-5">
        <div className="flex items-center gap-3">
          <Sparkles aria-hidden="true" size={22} className="text-[var(--animal-primary)]" />
          <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
            生成条件
          </h2>
        </div>

        <label className="block font-mono text-xs font-bold text-[var(--echo-muted)]">
          想生成什么样的美化
          <textarea
            value={userRequest}
            onChange={(event) => setUserRequest(event.target.value)}
            placeholder="例如：状态栏、短信界面、论坛帖子、任务面板、关系数值、背包卡片等。"
            className="mt-2 min-h-56 w-full resize-y rounded-[28px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-5 py-4 text-base leading-7 text-[var(--echo-text)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none focus:border-[var(--animal-focus-yellow)]"
          />
        </label>

        <div className="space-y-3">
          <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">开场白插入方式</p>
          {insertOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setInsertIntoGreeting(option.value)}
              className={cn(
                "w-full rounded-[24px] border-2 px-4 py-3 text-left shadow-[0_3px_0_0_var(--animal-shadow-input)]",
                insertIntoGreeting === option.value
                  ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-primary-active)]"
                  : "border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] text-[var(--animal-text-muted)]",
              )}
            >
              <span className="block font-display text-base font-black">{option.label}</span>
              <span className="mt-1 block font-mono text-xs leading-5">{option.description}</span>
            </button>
          ))}
        </div>

        <GenerationButton
          idleLabel="生成美化方案"
          runningLabel="正在生成美化方案"
          retryLabel="重新生成美化"
          status={generationStatus}
          errorMessage={error}
          onGenerate={handleGenerate}
          useAnimalLoadingButton
          className="w-full"
        />
        <Button type="button" variant="secondary" className="w-full" onClick={() => void handleFallback()}>
          <Code2 aria-hidden="true" size={16} />
          生成本地草案
        </Button>

        <div className="space-y-2">
          {assets.length ? (
            assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedId(asset.id)}
                className={cn(
                  "w-full rounded-[22px] border-2 px-4 py-3 text-left shadow-[0_3px_0_0_var(--animal-shadow-input)]",
                  selectedAsset?.id === asset.id
                    ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)]"
                    : "border-[var(--animal-border-light)] bg-[var(--animal-bg-input)]",
                )}
              >
                <span className="block truncate font-display text-base font-black text-[var(--echo-paper)]">
                  {asset.title}
                </span>
                <span className="mt-1 block font-mono text-xs text-[var(--animal-text-muted)]">
                  {asset.enabled ? "会写入角色卡" : "已停用"} ·{" "}
                  {asset.insertIntoGreeting === "all_adopted"
                    ? "插入所有开场白"
                    : asset.insertIntoGreeting === "primary"
                      ? "插入主开场白"
                      : "不插入开场白"}
                </span>
              </button>
            ))
          ) : (
            <p className="rounded-[24px] border-2 border-dashed border-[var(--animal-border-light)] p-4 font-mono text-sm text-[var(--animal-text-muted)]">
              还没有美化方案，可以先生成一套再检查预览。
            </p>
          )}
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        {selectedAsset ? (
          <>
            <section className="echo-text-card border-2 border-[var(--echo-line)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
                    BEAUTIFICATION
                  </p>
                  <input
                    value={selectedAsset.title}
                    onChange={(event) => void updateAsset({ title: event.target.value })}
                    className="mt-2 h-12 w-full min-w-0 rounded-[20px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 font-display text-2xl font-black text-[var(--echo-paper)] outline-none focus:border-[var(--animal-focus-yellow)] sm:min-w-96"
                  />
                </div>
                <label className="flex items-center gap-2 rounded-[20px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 py-3 font-mono text-sm font-bold text-[var(--echo-muted)]">
                  <input
                    type="checkbox"
                    checked={selectedAsset.enabled}
                    onChange={(event) => void updateAsset({ enabled: event.target.checked })}
                  />
                  写入角色卡 JSON
                </label>
              </div>
            </section>

            <section className="grid gap-5 2xl:grid-cols-2">
              <article className="echo-text-card border-2 border-[var(--echo-line)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-display text-xl font-black text-[var(--echo-paper)]">
                    <FileJson2 aria-hidden="true" size={20} />
                    WorldInfo 条目
                  </h3>
                  <Button type="button" size="sm" onClick={() => void saveWorldInfoJson()}>
                    <Save aria-hidden="true" size={14} />
                    保存
                  </Button>
                </div>
                <textarea
                  value={worldInfoJson}
                  onChange={(event) => setWorldInfoJson(event.target.value)}
                  className="min-h-80 w-full resize-y rounded-[24px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 py-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--animal-focus-yellow)]"
                />
                {worldInfoError ? (
                  <p className="mt-2 font-mono text-xs text-[var(--echo-stamp)]">{worldInfoError}</p>
                ) : null}
              </article>

              <article className="echo-text-card border-2 border-[var(--echo-line)]">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-black text-[var(--echo-paper)]">
                  <Regex aria-hidden="true" size={20} />
                  正则表达式
                </h3>
                <CodeMirror
                  value={selectedAsset.regex}
                  minHeight="120px"
                  theme="dark"
                  extensions={[javascript()]}
                  onChange={(value) => void updateAsset({ regex: value })}
                />
                <p className="mt-3 flex items-center gap-2 font-mono text-xs text-[var(--echo-muted)]">
                  {regexResult?.ok ? <Check aria-hidden="true" size={14} /> : <Regex aria-hidden="true" size={14} />}
                  {regexResult?.ok
                    ? `匹配成功，捕获 ${regexResult.groups.length} 组`
                    : regexResult?.error || "未匹配结构化内容"}
                </p>
              </article>
            </section>

            <section className="echo-text-card border-2 border-[var(--echo-line)]">
              <h3 className="mb-3 font-display text-xl font-black text-[var(--echo-paper)]">
                结构化内容
              </h3>
              <textarea
                value={selectedAsset.formattedOriginalText}
                onChange={(event) =>
                  void updateAsset({
                    formattedOriginalText: event.target.value,
                    originalText: event.target.value,
                  })
                }
                className="min-h-56 w-full resize-y rounded-[24px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 py-3 font-mono text-sm leading-7 text-[var(--echo-text)] outline-none focus:border-[var(--animal-focus-yellow)]"
              />
            </section>

            <section className="echo-text-card border-2 border-[var(--echo-line)]">
              <h3 className="mb-3 font-display text-xl font-black text-[var(--echo-paper)]">
                HTML / CSS / JavaScript
              </h3>
              <CodeMirror
                value={selectedAsset.html}
                minHeight="360px"
                theme="dark"
                extensions={splitCodeForExtensions(selectedAsset.html)}
                onChange={(value) => void updateAsset({ html: value })}
              />
            </section>

            <section className="echo-text-card border-2 border-[var(--echo-line)]">
              <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-black text-[var(--echo-paper)]">
                <Eye aria-hidden="true" size={20} />
                预览
              </h3>
              <iframe
                title="美化预览"
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                className="h-[34rem] w-full rounded-[24px] border-2 border-[var(--animal-border-light)] bg-white"
              />
            </section>
          </>
        ) : (
          <section className="echo-text-card flex min-h-[28rem] items-center justify-center border-2 border-dashed border-[var(--animal-border-light)]">
            <div className="max-w-md text-center">
              <WandSparkles
                aria-hidden="true"
                size={34}
                className="mx-auto text-[var(--animal-primary)]"
              />
              <h3 className="mt-4 font-display text-2xl font-black text-[var(--echo-paper)]">
                还没有可预览的美化
              </h3>
              <p className="mt-2 font-mono text-sm leading-7 text-[var(--echo-muted)]">
                先描述你想要的状态栏、面板或剧情装饰，生成后这里会展示结构、正则、代码和预览。
              </p>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

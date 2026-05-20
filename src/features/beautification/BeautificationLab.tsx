import CodeMirror from "@uiw/react-codemirror";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Regex,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Select } from "animal-island-ui";
import { useMemo, useState } from "react";

import type {
  BeautificationAsset,
  BeautificationGreetingInsertMode,
  BeautificationUiStyleId,
  Project,
} from "@/db/types";
import {
  applyBeautificationToGreetings,
  createBeautificationAsset,
  syncBeautificationWorldEntries,
  testBeautificationRegex,
} from "@/features/beautification/beautificationStore";
import { projectService } from "@/db/services/projectService";
import { nowIso } from "@/shared/lib/date";
import { GenerationButton } from "@/shared/components/GenerationButton";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { beautificationStylePresets } from "@/prompts/beautificationStylePresets";

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

function buildPreviewHtml(asset: BeautificationAsset) {
  try {
    const expression = new RegExp(asset.regex, "s");
    const replaced = asset.formattedOriginalText.replace(expression, asset.html);
    const previewBody = replaced === asset.formattedOriginalText && !expression.test(asset.formattedOriginalText)
      ? asset.html
      : replaced;
    return buildPreviewDocument(previewBody);
  } catch {
    return buildPreviewDocument(asset.html);
  }
}

function buildPreviewDocument(body: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      color: #725d42;
      background: #f8f8f0;
      font-family: Nunito, "Noto Sans SC", "PingFang SC", sans-serif;
    }
    body {
      padding: 18px;
      box-sizing: border-box;
    }
    details {
      width: min(100%, 720px);
      margin: 0 auto 14px;
      pointer-events: auto;
    }
    summary {
      cursor: pointer;
      list-style-position: inside;
      user-select: none;
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function formatStructuredText(value: string) {
  return value
    .trim()
    .replace(/>\s*</g, ">\n<")
    .replace(/(<statusblock[^>]*>)/gi, "$1\n")
    .replace(/(<\/statusblock>)/gi, "\n$1")
    .replace(/\n{3,}/g, "\n\n");
}

const insertOptions: Array<{ key: BeautificationGreetingInsertMode; label: string }> = [
  {
    key: "none",
    label: "不插入开场白",
  },
  {
    key: "primary",
    label: "插入主开场白",
  },
  {
    key: "all_adopted",
    label: "插入所有已采用开场白",
  },
];

const styleOptions = beautificationStylePresets.map((preset) => ({
  key: preset.id,
  label: preset.label,
}));

export function BeautificationLab({ project, onProjectChange }: BeautificationLabProps) {
  const [userRequest, setUserRequest] = useState("");
  const [uiStyle, setUiStyle] = useState<BeautificationUiStyleId>("none");
  const [insertIntoGreeting, setInsertIntoGreeting] =
    useState<BeautificationGreetingInsertMode>("none");
  const [selectedId, setSelectedId] = useState(project.beautifications?.[0]?.id ?? "");
  const [error, setError] = useState("");
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);
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
  const structuredText = useMemo(
    () => (selectedAsset ? formatStructuredText(selectedAsset.formattedOriginalText) : ""),
    [selectedAsset],
  );

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
    const nextProject = syncBeautificationWorldEntries(applyBeautificationToGreetings(nextBaseProject, asset));
    setSelectedId(asset.id);
    await persist(nextProject);
  }

  async function handleGenerate() {
    setGenerationStatus("running");
    setError("");
    try {
      const { asset } = await createBeautificationAsset(project, {
        userRequest,
        uiStyle,
        insertIntoGreeting,
      });
      await addAsset(asset);
      setGenerationStatus("succeeded");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "美化生成失败。");
      setGenerationStatus("failed");
    }
  }

  async function updateAsset(patch: Partial<BeautificationAsset>) {
    if (!selectedAsset) {
      return;
    }

    const nextAssets = assets.map((asset) =>
      asset.id === selectedAsset.id ? { ...asset, ...patch, updatedAt: nowIso() } : asset,
    );
    await persist(syncBeautificationWorldEntries({ ...project, beautifications: nextAssets, updatedAt: nowIso() }));
  }

  async function updateWorldInfo(patch: Partial<NonNullable<BeautificationAsset["worldInfo"]>>) {
    if (!selectedAsset) {
      return;
    }

    const worldInfo = selectedAsset.worldInfo ?? {
      comment: selectedAsset.title,
      content: "",
      constant: selectedAsset.insertIntoGreeting !== "none",
      keys: [],
      position: 4,
      depth: 4,
      insertion_order: selectedAsset.insertIntoGreeting === "none" ? 180 : 999,
    };
    const nextWorldInfo = { ...worldInfo, ...patch };
    await updateAsset({ worldInfo: nextWorldInfo, title: nextWorldInfo.comment || selectedAsset.title });
  }

  async function deleteAsset(assetId: string) {
    const nextAssets = assets.filter((asset) => asset.id !== assetId);
    setSelectedId(nextAssets[0]?.id ?? "");
    await persist(syncBeautificationWorldEntries({ ...project, beautifications: nextAssets, updatedAt: nowIso() }));
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
          <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">预置UI风格</p>
          <Select
            options={styleOptions}
            value={uiStyle}
            onChange={(value) => setUiStyle(value as BeautificationUiStyleId)}
          />
        </div>

        <div className="space-y-3">
          <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">是否插入开场白</p>
          <Select
            options={insertOptions}
            value={insertIntoGreeting}
            onChange={(value) => setInsertIntoGreeting(value as BeautificationGreetingInsertMode)}
          />
        </div>

        <GenerationButton
          idleLabel="生成美化方案"
          runningLabel="正在生成美化方案"
          retryLabel="重新生成美化"
          status={generationStatus}
          errorMessage={error}
          onGenerate={handleGenerate}
          useAnimalLoadingButton
          disabled={!userRequest.trim()}
          className="w-full"
        />
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
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
                    美化方案名称
                  </p>
                  <input
                    value={selectedAsset.title}
                    onChange={(event) => void updateAsset({ title: event.target.value })}
                    className="mt-2 h-12 w-full min-w-0 rounded-[20px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 font-display text-xl font-black text-[var(--echo-paper)] outline-none focus:border-[var(--animal-focus-yellow)]"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-[var(--animal-radius-pill)] border border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] px-3 font-mono text-[11px] font-black text-[var(--animal-primary-active)]">
                    <Check aria-hidden="true" size={14} />
                    已自动保存
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    danger
                    onClick={() => void deleteAsset(selectedAsset.id)}
                    className="h-8 px-3 text-[11px] shadow-none hover:shadow-none"
                  >
                    <Trash2 aria-hidden="true" size={13} />
                    删除方案
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <article className="echo-text-card border-2 border-[var(--echo-line)]">
                <h3 className="mb-3 font-display text-xl font-black text-[var(--echo-paper)]">
                  世界书条目
                </h3>
                <label className="block font-mono text-xs font-bold text-[var(--echo-muted)]">
                  条目标题
                  <input
                    value={selectedAsset.worldInfo?.comment ?? selectedAsset.title}
                    onChange={(event) => void updateWorldInfo({ comment: event.target.value })}
                    className="mt-2 h-12 w-full rounded-[20px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 text-base text-[var(--echo-text)] outline-none focus:border-[var(--animal-focus-yellow)]"
                  />
                </label>
                <label className="mt-4 block font-mono text-xs font-bold text-[var(--echo-muted)]">
                  条目内容
                  <textarea
                    value={selectedAsset.worldInfo?.content ?? ""}
                    onChange={(event) => void updateWorldInfo({ content: event.target.value })}
                    className="mt-2 min-h-64 w-full resize-y rounded-[24px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 py-3 text-sm leading-7 text-[var(--echo-text)] outline-none focus:border-[var(--animal-focus-yellow)]"
                  />
                </label>
                {selectedAsset.worldInfo?.keys?.length ? (
                  <label className="mt-4 block font-mono text-xs font-bold text-[var(--echo-muted)]">
                    关键词
                    <input
                      value={selectedAsset.worldInfo.keys.join("，")}
                      onChange={(event) =>
                        void updateWorldInfo({
                          keys: event.target.value
                            .split(/[，,]/)
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                      className="mt-2 h-12 w-full rounded-[20px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 text-base text-[var(--echo-text)] outline-none focus:border-[var(--animal-focus-yellow)]"
                    />
                  </label>
                ) : null}
              </article>

              <article className="echo-text-card border-2 border-[var(--echo-line)]">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-black text-[var(--echo-paper)]">
                  <Regex aria-hidden="true" size={20} />
                  正则表达式
                </h3>
                <label className="mb-3 block font-mono text-xs font-bold text-[var(--echo-muted)]">
                  正则标题
                  <input
                    value={selectedAsset.regexTitle ?? selectedAsset.title}
                    onChange={(event) => void updateAsset({ regexTitle: event.target.value })}
                    className="mt-2 h-12 w-full rounded-[20px] border-2 border-[var(--animal-border-light)] bg-[var(--animal-bg-input)] px-4 text-base text-[var(--echo-text)] outline-none focus:border-[var(--animal-focus-yellow)]"
                  />
                </label>
                <CodeMirror
                  value={selectedAsset.regex}
                  height="120px"
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
                value={structuredText}
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl font-black text-[var(--echo-paper)]">
                  美化代码
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCodeExpanded((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] px-4 py-2 font-mono text-xs font-black text-[var(--animal-text-body)] shadow-[0_3px_0_0_var(--animal-shadow-input)]"
                >
                  {isCodeExpanded ? (
                    <ChevronUp aria-hidden="true" size={14} />
                  ) : (
                    <ChevronDown aria-hidden="true" size={14} />
                  )}
                  {isCodeExpanded ? "收起代码" : "展开全部"}
                </button>
              </div>
              <CodeMirror
                value={selectedAsset.html}
                height={isCodeExpanded ? "420px" : "8.8rem"}
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

import CodeMirror from "@uiw/react-codemirror";
import { css } from "@codemirror/lang-css";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { Check, Code2, FlaskConical, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";

import type { BeautificationAsset, Project } from "@/db/types";
import {
  createBeautificationAsset,
  createFallbackBeautificationAsset,
  testBeautificationRegex,
} from "@/features/beautification/beautificationStore";
import { projectService } from "@/db/services/projectService";
import { nowIso } from "@/shared/lib/date";
import { Button } from "@/shared/components/ui/button";

interface BeautificationLabProps {
  project: Project;
  onProjectChange: (project: Project) => void;
}

function splitCodeForExtensions(value: string) {
  if (value.includes("<style") || value.includes("<script")) {
    return [htmlLanguage()];
  }

  if (value.includes("{") && value.includes("}")) {
    return [css(), javascript({ jsx: true })];
  }

  return [htmlLanguage()];
}

export function BeautificationLab({ project, onProjectChange }: BeautificationLabProps) {
  const [originalText, setOriginalText] = useState("姓名：{{char}}\n状态：平静\n距离：三步之外");
  const [userRequest, setUserRequest] = useState("生成可折叠的诗意状态栏，像小岛留言板上的微光标签。");
  const [selectedId, setSelectedId] = useState(project.beautifications?.[0]?.id ?? "");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const assets = project.beautifications ?? [];
  const selectedAsset = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  const regexResult = useMemo(
    () =>
      selectedAsset
        ? testBeautificationRegex(selectedAsset.regex, selectedAsset.formattedOriginalText)
        : undefined,
    [selectedAsset],
  );

  async function persist(nextProject: Project) {
    const { id, createdAt, ...patch } = nextProject;
    void createdAt;
    const saved = await projectService.updateProject(id, patch);
    if (saved) {
      onProjectChange(saved);
    }
  }

  async function addAsset(asset: BeautificationAsset) {
    const nextProject: Project = {
      ...project,
      beautifications: [asset, ...assets],
      updatedAt: nowIso(),
    };
    setSelectedId(asset.id);
    await persist(nextProject);
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setError("");
    try {
      const { asset } = await createBeautificationAsset(project, { originalText, userRequest });
      await addAsset(asset);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "美化生成失败。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleFallback() {
    await addAsset(createFallbackBeautificationAsset(project, { originalText, userRequest }));
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

  return (
    <section className="border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            阶段 14
          </p>
          <h2 className="mt-2 font-display text-3xl font-black text-[var(--echo-paper)]">
            美化代码与正则绑定器
          </h2>
          <p className="mt-2 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            一次生成开场白可插入文本、正则脚本、WorldInfo 格式说明和可视化 HTML/CSS/JS。
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void handleFallback()}>
          <Code2 aria-hidden="true" size={18} />
          生成本地草案
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <label className="grid gap-2 text-sm font-bold text-[var(--echo-paper)]">
            Original Text
            <textarea
              value={originalText}
              onChange={(event) => setOriginalText(event.target.value)}
              rows={7}
              className="resize-y border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[var(--echo-paper)]">
            美化请求
            <textarea
              value={userRequest}
              onChange={(event) => setUserRequest(event.target.value)}
              rows={4}
              className="resize-y border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
            />
          </label>
          <Button type="button" loading={isGenerating} disabled={isGenerating} onClick={() => void handleGenerate()}>
            {isGenerating ? null : <WandSparkles aria-hidden="true" size={18} />}
            生成美化方案
          </Button>
          {error && (
            <p className="border border-[var(--echo-stamp)] bg-[rgba(120,40,34,0.18)] p-3 font-mono text-sm text-[var(--echo-paper)]">
              {error}
            </p>
          )}
          <div className="space-y-2">
            {assets.length ? (
              assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelectedId(asset.id)}
                  className={`w-full border p-3 text-left font-mono text-sm ${
                    selectedAsset?.id === asset.id
                      ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
                      : "border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] text-[var(--echo-muted)]"
                  }`}
                >
                  <span className="block font-bold">{asset.title}</span>
                  <span className="mt-1 block text-xs">策略：{asset.strategy === "complex" ? "Complex" : "Simple"}</span>
                </button>
              ))
            ) : (
              <p className="border border-dashed border-[var(--echo-line)] p-4 font-mono text-sm text-[var(--echo-muted)]">
                还没有美化方案。
              </p>
            )}
          </div>
        </div>

        {selectedAsset && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-[var(--echo-paper)]">
                标题
                <input
                  value={selectedAsset.title}
                  onChange={(event) => void updateAsset({ title: event.target.value })}
                  className="h-10 border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 font-mono text-sm text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                />
              </label>
              <label className="flex items-center gap-2 border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 py-2 font-mono text-sm text-[var(--echo-muted)]">
                <input
                  type="checkbox"
                  checked={selectedAsset.enabled}
                  onChange={(event) => void updateAsset({ enabled: event.target.checked })}
                />
                导出到角色卡 JSON
              </label>
            </div>

            <section className="border border-[var(--echo-line)]">
              <div className="flex items-center gap-2 border-b border-[var(--echo-line)] p-3 font-mono text-sm text-[var(--echo-muted)]">
                {regexResult?.ok ? <Check aria-hidden="true" size={16} /> : <FlaskConical aria-hidden="true" size={16} />}
                正则测试：{regexResult?.ok ? `匹配成功，捕获 ${regexResult.groups.length} 组` : regexResult?.error || "未匹配"}
              </div>
              <CodeMirror
                value={selectedAsset.regex}
                minHeight="82px"
                theme="dark"
                extensions={[javascript()]}
                onChange={(value) => void updateAsset({ regex: value })}
              />
            </section>

            <section className="border border-[var(--echo-line)]">
              <p className="border-b border-[var(--echo-line)] p-3 font-mono text-sm font-bold text-[var(--echo-paper)]">
                HTML / CSS / JS
              </p>
              <CodeMirror
                value={selectedAsset.html}
                minHeight="260px"
                theme="dark"
                extensions={splitCodeForExtensions(selectedAsset.html)}
                onChange={(value) => void updateAsset({ html: value })}
              />
            </section>

            <section className="border border-[var(--echo-line)] p-3">
              <p className="font-mono text-sm font-bold text-[var(--echo-paper)]">实时预览</p>
              <iframe
                title="美化预览"
                srcDoc={selectedAsset.html}
                className="mt-3 h-72 w-full border border-[var(--echo-line)] bg-white"
              />
            </section>

            <label className="grid gap-2 text-sm font-bold text-[var(--echo-paper)]">
              插入开场白或回复中的格式文本
              <textarea
                value={selectedAsset.formattedOriginalText}
                onChange={(event) => void updateAsset({ formattedOriginalText: event.target.value })}
                rows={6}
                className="resize-y border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
              />
            </label>
          </div>
        )}
      </div>
    </section>
  );
}

import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  IdCard,
  ImageUp,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { projectService } from "@/db/services/projectService";
import type { Project } from "@/db/types";
import { CharacterProfileModal } from "@/features/characterProfile/CharacterProfileModal";
import { hasUsableCharacterProfile } from "@/features/characterProfile/characterProfileGuards";
import {
  generateAndSaveCharacterProfile,
  saveCharacterProfileYaml,
} from "@/features/characterProfile/characterProfileService";
import { useExportStore } from "@/features/export/exportStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { generateExportCardCompletion, generateExportImagePrompt } from "@/features/llm/llmClient";
import { ProfileReportPanel } from "@/features/report/ProfileReportPanel";
import { collectPromptWorldEntries } from "@/features/world/worldPromptContext";
import { Button } from "@/shared/components/ui/button";
import { nowIso } from "@/shared/lib/date";

export function StepExport() {
  const { projectId } = useParams();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const { status, error, buildJson, buildPng } = useExportStore();
  const [project, setProject] = useState<Project>();
  const [cardName, setCardName] = useState("");
  const [versionLabel, setVersionLabel] = useState("1.0");
  const [creator, setCreator] = useState("MOI");
  const [imageFile, setImageFile] = useState<File>();
  const [pageError, setPageError] = useState("");
  const [completionStatus, setCompletionStatus] = useState<"idle" | "running" | "succeeded" | "failed">("idle");
  const [imagePromptStatus, setImagePromptStatus] = useState<"idle" | "running" | "succeeded" | "failed">("idle");
  const [characterProfileStatus, setCharacterProfileStatus] = useState<"idle" | "running" | "succeeded" | "failed">("idle");
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    projectService
      .resolveProject(projectId)
      .then(async (resolvedProject) => {
        if (!mounted) {
          return;
        }
        if (!resolvedProject) {
          setPageError("这里还没有 TA 的记录。");
          return;
        }
        setProject(resolvedProject);
        setCardName(resolvedProject.title);
        setCreator(resolvedProject.exportDraft?.creator || "MOI");
      })
      .catch((loadError: unknown) => {
        if (mounted) {
          setPageError(loadError instanceof Error ? loadError.message : "读取导出信息失败。");
        }
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!project) {
      return;
    }

    const nextTitle = cardName.trim();
    const nextCreator = creator.trim();
    const titleChanged = nextTitle && nextTitle !== project.title;
    const creatorChanged = nextCreator !== (project.exportDraft?.creator ?? "MOI");
    if (!titleChanged && !creatorChanged) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const updatedAt = nowIso();
      void projectService
        .updateProject(project.id, {
          title: titleChanged ? nextTitle : project.title,
          exportDraft: {
            ...project.exportDraft,
            creator: nextCreator,
            updatedAt,
          },
        })
        .then((saved) => {
          if (saved) {
            setProject(saved);
          }
        })
        .catch((saveError: unknown) => {
          setPageError(saveError instanceof Error ? saveError.message : "保存导出信息失败。");
        });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [cardName, creator, project]);

  const isBuilding = status === "building";
  const isCompleting = completionStatus === "running";
  const isGeneratingImagePrompt = imagePromptStatus === "running";
  const cardCompletion = project?.exportDraft?.cardCompletion;
  const imagePrompt = project?.exportDraft?.imagePrompt?.prompt;
  const hasValidCharacterProfile = hasUsableCharacterProfile(project?.characterProfile);
  const isGeneratingCharacterProfile =
    characterProfileStatus === "running" ||
    (project?.characterProfile?.status === "generating" && !hasValidCharacterProfile);
  const canExport = Boolean(
    project &&
      cardName.trim() &&
      cardCompletion &&
      hasValidCharacterProfile &&
      !isBuilding &&
      !isCompleting,
  );

  async function persistExportDraft(nextProject: Project) {
    const { id, createdAt, ...patch } = nextProject;
    void createdAt;
    const saved = await projectService.updateProject(id, patch);
    if (saved) {
      setProject(saved);
    }
    return saved;
  }

  async function handleCompleteCard() {
    if (!project || isCompleting) {
      return;
    }
    if (!hasValidCharacterProfile) {
      setPageError("角色信息尚未成功生成。请先通过角色档案生成角色信息，再补全角色卡信息。");
      return;
    }

    setCompletionStatus("running");
    setPageError("");

    try {
      const result = await generateExportCardCompletion({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        characterInfoYaml: project.characterProfile?.yaml,
        confirmedEntries: collectPromptWorldEntries(project),
      });
      const updatedAt = nowIso();
      await persistExportDraft({
        ...project,
        exportDraft: {
          ...project.exportDraft,
          creator: creator.trim(),
          cardCompletion: {
            ...result.data,
            generationId: result.taskId,
            updatedAt,
          },
          updatedAt,
        },
        updatedAt,
      });
      setCompletionStatus("succeeded");
    } catch (completionError) {
      setCompletionStatus("failed");
      setPageError(completionError instanceof Error ? completionError.message : "角色卡信息补全失败。");
    }
  }

  async function clearStaleExportCompletion(nextProject: Project) {
    if (!nextProject.exportDraft?.cardCompletion && !nextProject.exportDraft?.imagePrompt) {
      setProject(nextProject);
      return nextProject;
    }

    const { cardCompletion: _cardCompletion, imagePrompt: _imagePrompt, ...restDraft } = nextProject.exportDraft;
    void _cardCompletion;
    void _imagePrompt;
    const updatedAt = nowIso();
    const saved = await projectService.updateProject(nextProject.id, {
      exportDraft: {
        ...restDraft,
        updatedAt,
      },
      updatedAt,
    });
    setProject(saved ?? nextProject);
    return saved ?? nextProject;
  }

  async function handleGenerateCharacterProfile() {
    if (!project || isGeneratingCharacterProfile) {
      return;
    }

    setCharacterProfileStatus("running");
    setPageError("");
    setProject({
      ...project,
      characterProfile: {
        yaml: project.characterProfile?.yaml ?? "",
        status: "generating",
        retryCount: project.characterProfile?.retryCount ?? 0,
        updatedAt: nowIso(),
      },
    });

    try {
      const updatedProject = await generateAndSaveCharacterProfile(project.id, project.dossier.markdown);
      if (!updatedProject) {
        throw new Error("角色信息生成失败，未找到当前项目。");
      }
      await clearStaleExportCompletion(updatedProject);
      setCharacterProfileStatus(updatedProject.characterProfile?.status === "succeeded" ? "succeeded" : "failed");
      if (updatedProject.characterProfile?.status !== "succeeded") {
        setPageError(updatedProject.characterProfile?.errorMessage ?? "角色信息生成失败。");
      }
    } catch (profileError) {
      setCharacterProfileStatus("failed");
      setPageError(profileError instanceof Error ? profileError.message : "角色信息生成失败。");
    }
  }

  async function handleSaveCharacterProfile(nextYaml: string) {
    if (!project) {
      return;
    }
    const updatedProject = await saveCharacterProfileYaml(project.id, nextYaml);
    if (updatedProject) {
      await clearStaleExportCompletion(updatedProject);
    }
  }

  async function handleGenerateImagePrompt() {
    if (!project || isGeneratingImagePrompt) {
      return;
    }
    if (!hasValidCharacterProfile) {
      setPageError("角色信息尚未成功生成。请先通过角色档案生成角色信息，再生成文生图提示词。");
      return;
    }

    setImagePromptStatus("running");
    setPageError("");

    try {
      const result = await generateExportImagePrompt({
        projectId: project.id,
        dossierMarkdown: project.dossier.markdown,
        characterInfoYaml: project.characterProfile?.yaml,
      });
      const updatedAt = nowIso();
      await persistExportDraft({
        ...project,
        exportDraft: {
          ...project.exportDraft,
          creator: creator.trim(),
          imagePrompt: {
            prompt: result.data.prompt,
            generationId: result.taskId,
            updatedAt,
          },
          updatedAt,
        },
        updatedAt,
      });
      setImagePromptStatus("succeeded");
    } catch (promptError) {
      setImagePromptStatus("failed");
      setPageError(promptError instanceof Error ? promptError.message : "文生图提示词生成失败。");
    }
  }

  async function handleOpenImageGenerator() {
    if (!imagePrompt) {
      return;
    }

    try {
      await navigator.clipboard.writeText(imagePrompt);
      window.open("https://www.doubao.com/chat/create-image", "_blank", "noopener,noreferrer");
    } catch (copyError) {
      setPageError(copyError instanceof Error ? copyError.message : "复制提示词失败，请检查浏览器权限。");
    }
  }

  async function handleJsonExport() {
    if (!project) {
      return;
    }
    if (!hasValidCharacterProfile) {
      setPageError("角色信息尚未成功生成。请先通过角色档案生成角色信息。");
      return;
    }
    if (!cardCompletion) {
      setPageError("请先使用 AI 补全角色卡信息。");
      return;
    }

    await buildJson({ project, versionLabel, creator });
    markStepCompleted("export");
  }

  async function handlePngExport() {
    if (!project || !imageFile) {
      setPageError("请先上传一张 JPG、PNG 或 WebP 图片作为载体。");
      return;
    }
    if (!hasValidCharacterProfile) {
      setPageError("角色信息尚未成功生成。请先通过角色档案生成角色信息。");
      return;
    }
    if (!cardCompletion) {
      setPageError("请先使用 AI 补全角色卡信息。");
      return;
    }

    setPageError("");
    await buildPng({ project, versionLabel, creator, imageFile });
    markStepCompleted("export");
  }

  if (pageError && !project) {
    return (
      <section className="p-6">
        <div className="border-2 border-[var(--echo-line)] bg-[var(--echo-panel)] p-8 text-[var(--echo-paper)]">
          {pageError}
        </div>
      </section>
    );
  }

  return (
    <section className="echo-workspace-page">
      <div className="echo-workspace-inner space-y-6">
        <article className="echo-section-card min-w-0">
          <div className="space-y-8">
            <div className="min-w-0 self-start">
              <Archive aria-hidden="true" size={26} className="text-[var(--echo-paper)]" />
              <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
                带 TA 回来
              </p>
              <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
                导出记录
              </h1>
              <p className="mt-4 max-w-2xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
                将已确认的记录、WorldInfo、开场白和相处测试记录整理为 SillyTavern Character Card V3。
              </p>
            </div>

            <div className="grid min-w-0 gap-5">
              <div className="grid items-start gap-4 rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.36)] p-5 max-sm:p-4 md:grid-cols-[minmax(0,1fr)_minmax(8rem,11rem)_minmax(10rem,14rem)]">
                <label className="grid self-start gap-3 text-sm font-bold text-[var(--echo-paper)]">
                  角色卡名称
                  <input
                    value={cardName}
                    onChange={(event) => setCardName(event.target.value)}
                    className="h-11 w-full border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 font-mono text-sm text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                  />
                </label>
                <label className="grid self-start gap-3 text-sm font-bold text-[var(--echo-paper)]">
                  版本
                  <input
                    value={versionLabel}
                    onChange={(event) => setVersionLabel(event.target.value)}
                    className="h-11 w-full border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 font-mono text-sm text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                  />
                </label>
                <label className="grid self-start gap-3 text-sm font-bold text-[var(--echo-paper)]">
                  署名
                  <input
                    value={creator}
                    onChange={(event) => setCreator(event.target.value)}
                    className="h-11 w-full border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] px-3 font-mono text-sm text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                  />
                </label>
              </div>

              <div className="grid gap-4">
                {!hasValidCharacterProfile ? (
                  <section className="rounded-[var(--animal-radius)] border-2 border-[var(--echo-stamp)] bg-[rgba(120,40,34,0.18)] p-5 max-sm:p-4">
                    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="flex min-w-0 items-start gap-3">
                        <AlertTriangle aria-hidden="true" size={24} className="mt-1 shrink-0 text-[var(--echo-paper)]" />
                        <div className="min-w-0">
                          <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
                            角色信息尚未成功生成
                          </h2>
                          <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-paper)]">
                            当前导出缺少角色信息 YAML，可能导致角色设定变成“暂未明确”。请先通过角色档案生成角色信息，再补全导出字段。
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 sm:justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!project}
                          onClick={() => setIsCharacterModalOpen(true)}
                          className="w-full sm:w-fit"
                        >
                          <IdCard aria-hidden="true" size={17} />
                          打开角色信息
                        </Button>
                        <Button
                          type="button"
                          loading={isGeneratingCharacterProfile}
                          disabled={!project}
                          onClick={() => void handleGenerateCharacterProfile()}
                          className="w-full border-[var(--animal-primary-active)] bg-[var(--animal-primary)] text-white shadow-[0_5px_0_0_var(--animal-primary-active)] hover:bg-[var(--animal-primary-hover)] hover:shadow-[0_6px_0_0_var(--animal-primary-active)] sm:w-fit"
                        >
                          {isGeneratingCharacterProfile ? null : <Sparkles aria-hidden="true" size={17} />}
                          {isGeneratingCharacterProfile ? "生成中" : "通过角色档案生成"}
                        </Button>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className={`rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5 max-sm:p-4 ${isCompleting ? "animate-pulse" : ""}`}>
                  <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      {cardCompletion ? (
                        <CheckCircle2 aria-hidden="true" size={22} className="mt-1 shrink-0 text-[var(--animal-primary)]" />
                      ) : (
                        <Sparkles aria-hidden="true" size={22} className="mt-1 shrink-0 text-[var(--echo-paper)]" />
                      )}
                      <div className="min-w-0">
                        <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
                          AI 补全角色卡信息
                        </h2>
                        <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                          生成 description、personality 和 tags。完成后才能导出 JSON 或 PNG。
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      loading={isCompleting}
                      disabled={!project || !hasValidCharacterProfile}
                      onClick={() => void handleCompleteCard()}
                      className={`w-full sm:w-fit ${isCompleting ? "animate-pulse border-[var(--animal-primary-active)] bg-[var(--animal-primary)] text-white shadow-[0_5px_0_0_var(--animal-primary-active)]" : ""}`}
                    >
                      {isCompleting ? null : <Sparkles aria-hidden="true" size={18} />}
                      {isCompleting ? "生成中" : cardCompletion ? "重新生成" : "开始生成"}
                    </Button>
                  </div>

                  {cardCompletion && (
                    <div className="mt-5 grid gap-3 rounded-[var(--animal-radius-sm)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.36)] p-4 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                      <p>
                        <span className="font-black text-[var(--echo-paper)]">简介：</span>
                        {cardCompletion.description}
                      </p>
                      <p>
                        <span className="font-black text-[var(--echo-paper)]">性格：</span>
                        {cardCompletion.personality}
                      </p>
                      <p>
                        <span className="font-black text-[var(--echo-paper)]">标签：</span>
                        {cardCompletion.tags.join("、")}
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5 max-sm:p-4">
                  <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <FileJson aria-hidden="true" size={22} className="mt-1 shrink-0 text-[var(--echo-paper)]" />
                      <div className="min-w-0">
                        <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
                          格式化 JSON
                        </h2>
                        <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                          下载可解析的 Character Card V3 JSON。
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full border-[var(--animal-primary-active)] bg-[var(--animal-primary)] text-white shadow-[0_5px_0_0_var(--animal-primary-active)] hover:bg-[var(--animal-primary-hover)] hover:shadow-[0_6px_0_0_var(--animal-primary-active)] sm:w-fit"
                      loading={isBuilding}
                      disabled={!canExport}
                      onClick={() => void handleJsonExport()}
                    >
                      {isBuilding ? null : <Download aria-hidden="true" size={18} />}
                      导出 JSON
                    </Button>
                  </div>
                </section>

                <section className="rounded-[var(--animal-radius)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5 max-sm:p-4">
                  <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <ImageUp aria-hidden="true" size={22} className="mt-1 shrink-0 text-[var(--echo-paper)]" />
                        <div className="min-w-0">
                          <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
                            内嵌 PNG
                          </h2>
                          <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                            上传图片，写入 chara 与 ccv3 文本区块。
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap items-center gap-3 max-sm:grid">
                        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] px-5 text-sm font-black text-[var(--animal-text-body)] shadow-[0_4px_0_0_var(--animal-shadow-input)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--animal-border-hover)] hover:shadow-[0_5px_0_0_var(--animal-shadow-input)] max-sm:w-full">
                          <Upload aria-hidden="true" size={17} />
                          选择图片
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => setImageFile(event.target.files?.[0])}
                            className="sr-only"
                          />
                        </label>
                        <span className="min-w-0 max-w-full truncate rounded-[var(--animal-radius-pill)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.34)] px-4 py-2 font-mono text-sm font-bold text-[var(--echo-muted)]">
                          {imageFile?.name ?? "尚未选择图片"}
                        </span>
                      </div>
                      <div className="mt-5 rounded-[var(--animal-radius-sm)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.34)] p-4">
                        <div className="echo-mobile-action-row flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-display text-xl font-black text-[var(--echo-paper)]">
                              文生图提示词
                            </h3>
                            <p className="mt-1 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                              生成适合当前角色的图片提示词，跳转前会自动复制。
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            loading={isGeneratingImagePrompt}
                            disabled={!project || !hasValidCharacterProfile}
                            onClick={() => void handleGenerateImagePrompt()}
                            className={isGeneratingImagePrompt ? "animate-pulse border-[var(--animal-primary-active)] bg-[var(--animal-primary)] text-white shadow-[0_5px_0_0_var(--animal-primary-active)]" : ""}
                          >
                            {isGeneratingImagePrompt ? null : <Sparkles aria-hidden="true" size={16} />}
                            {isGeneratingImagePrompt ? "生成中" : imagePrompt ? "重新生成" : "生成提示词"}
                          </Button>
                        </div>
                        {imagePrompt && (
                          <div className="mt-4 grid gap-3">
                            <p className="max-h-32 overflow-auto rounded-[var(--animal-radius-sm)] border border-[var(--echo-line)] bg-[rgba(255,255,255,0.36)] p-3 font-mono text-sm leading-6 text-[var(--echo-muted)]">
                              {imagePrompt}
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              className="w-full sm:w-fit"
                              onClick={() => void handleOpenImageGenerator()}
                            >
                              <Copy aria-hidden="true" size={16} />
                              复制并打开豆包
                              <ExternalLink aria-hidden="true" size={16} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full border-[var(--animal-primary-active)] bg-[var(--animal-primary)] text-white shadow-[0_5px_0_0_var(--animal-primary-active)] hover:bg-[var(--animal-primary-hover)] hover:shadow-[0_6px_0_0_var(--animal-primary-active)] sm:w-fit"
                      loading={isBuilding}
                      disabled={!canExport}
                      onClick={() => void handlePngExport()}
                    >
                      {isBuilding ? null : <Download aria-hidden="true" size={18} />}
                      导出 PNG
                    </Button>
                  </div>
                </section>
              </div>
            </div>
          </div>

          {(error || pageError) && (
            <p className="mt-5 border border-[var(--echo-stamp)] bg-[rgba(120,40,34,0.18)] p-3 font-mono text-sm text-[var(--echo-paper)]">
              {error || pageError}
            </p>
          )}
        </article>

        {project && <ProfileReportPanel project={project} />}
      </div>
      {project ? (
        <CharacterProfileModal
          open={isCharacterModalOpen}
          yaml={project.characterProfile?.yaml ?? ""}
          isRefreshing={isGeneratingCharacterProfile}
          onClose={() => setIsCharacterModalOpen(false)}
          onRefresh={handleGenerateCharacterProfile}
          onSave={handleSaveCharacterProfile}
        />
      ) : null}
    </section>
  );
}

import { Collapse } from "animal-island-ui";
import { Archive, Check, MessageCircle, Pencil, Search, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type {
  GreetingVariant,
  HelloChatMessage,
  HelloChatMode,
  HelloChatSession,
  Project,
} from "@/db/types";
import { historyService } from "@/db/services/historyService";
import { projectService } from "@/db/services/projectService";
import { buildDossierBlockMeta } from "@/features/dossier/dossierSections";
import { useDossierStore } from "@/features/dossier/dossierStore";
import { useFlowStore } from "@/features/flow/flowStore";
import { getAdoptedGreetingVariants } from "@/features/greeting/greetingStore";
import {
  applyHelloBeautificationsForPreview,
  hasHtmlLikeContent,
} from "@/features/hello/helloBeautificationPreview";
import { generateHelloChatReply, generateHelloRevision } from "@/features/llm/llmClient";
import { useSettingsStore } from "@/features/settings/settingsStore";
import { EmptyState } from "@/shared/components/EmptyState";
import { Button } from "@/shared/components/ui/button";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";
import { cn } from "@/shared/lib/utils";

type RevisionChange = {
  source: "dossier" | "character_info" | "worldinfo" | "greeting";
  targetId?: string;
  title: string;
  before: string;
  after: string;
  reason: string;
};

type RevisionDraft = {
  summary: string;
  changes: RevisionChange[];
};

type RevisionTarget = {
  message: HelloChatMessage;
  session: HelloChatSession;
};

const chatModeLabels: Record<HelloChatMode, string> = {
  greeting: "从开场白开始",
  casual: "简单聊聊",
};

const chatModeLimits: Record<HelloChatMode, number> = {
  greeting: 10,
  casual: 20,
};

const sourceLabels: Record<RevisionChange["source"], string> = {
  dossier: "角色档案",
  character_info: "角色信息",
  worldinfo: "WorldInfo",
  greeting: "开场白",
};

export function StepHello() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<HelloChatMode>("greeting");
  const [selectedGreetingId, setSelectedGreetingId] = useState<string | undefined>();
  const [inputText, setInputText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [revisionTarget, setRevisionTarget] = useState<RevisionTarget | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisionDraft, setRevisionDraft] = useState<RevisionDraft | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [isRevising, setIsRevising] = useState(false);
  const { load: loadSettings, getAvailability } = useSettingsStore();
  const { hydrateFromProject } = useDossierStore();
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let ignored = false;

    async function loadProject() {
      setIsLoading(true);
      const resolvedProject = await projectService.resolveProject(projectId);
      if (ignored) {
        return;
      }

      if (resolvedProject) {
        hydrateFromProject(resolvedProject);
        const adoptedGreetings = getAdoptedGreetingVariants(resolvedProject);
        setSelectedGreetingId(adoptedGreetings[0]?.id);
      }
      setProject(resolvedProject ?? null);
      setIsLoading(false);
    }

    void loadProject();
    return () => {
      ignored = true;
    };
  }, [hydrateFromProject, projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [project, mode, selectedGreetingId, isSending]);

  const adoptedGreetings = useMemo(
    () => (project ? getAdoptedGreetingVariants(project) : []),
    [project],
  );
  const selectedGreeting = adoptedGreetings.find((greeting) => greeting.id === selectedGreetingId);
  const currentSession = project
    ? getOrCreateSession(project, mode, selectedGreeting, { persist: false }).session
    : null;
  const roundCount = currentSession ? countUserRounds(currentSession) : 0;
  const maxRounds = chatModeLimits[mode];
  const isLimitReached = roundCount >= maxRounds;
  const latestEditableMessageId = currentSession ? getLatestEditableUserMessageId(currentSession) : null;

  async function persistProject(nextProject: Project, snapshotTitle?: string, generationIds: string[] = []) {
    const { id, createdAt, ...patch } = nextProject;
    void createdAt;
    const updatedProject = await projectService.updateProject(id, patch);
    if (updatedProject) {
      hydrateFromProject(updatedProject);
      setProject(updatedProject);
      if (snapshotTitle) {
        await historyService.createSnapshot(updatedProject.id, snapshotTitle, generationIds);
      }
    }
    return updatedProject;
  }

  async function handleModeChange(nextMode: HelloChatMode) {
    if (!project || isSending) {
      return;
    }
    setMode(nextMode);
    setErrorMessage(null);
    if (nextMode === "greeting" && !selectedGreetingId) {
      setSelectedGreetingId(adoptedGreetings[0]?.id);
    }
  }

  async function handleGreetingChange(greetingId: string) {
    if (isSending) {
      return;
    }
    setSelectedGreetingId(greetingId);
    setErrorMessage(null);
  }

  async function handleTakeAway() {
    if (!project) {
      return;
    }

    const updatedProject = await persistProject(
      {
        ...project,
        currentStep: "export",
      },
      "完成打招呼",
    );

    if (updatedProject) {
      markStepCompleted("hello");
      navigate(`/workspace/${updatedProject.id}/export`);
    }
  }

  async function handleSend() {
    const text = inputText.trim();
    if (!project || !text || isSending || isLimitReached) {
      return;
    }

    await sendMessage(project, text);
  }

  async function sendMessage(baseProject: Project, text: string) {
    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    const { project: sessionProject, session } = getOrCreateSession(baseProject, mode, selectedGreeting, {
      persist: true,
    });
    const createdAt = nowIso();
    const userMessage: HelloChatMessage = {
      id: createId("msg"),
      role: "user",
      content: text,
      createdAt,
    };
    const assistantMessage: HelloChatMessage = {
      id: createId("msg"),
      role: "assistant",
      content: "",
      createdAt,
    };
    const nextSession = {
      ...session,
      messages: [...session.messages, userMessage, assistantMessage],
      updatedAt: createdAt,
    };

    setInputText("");
    setErrorMessage(null);
    setIsSending(true);
    setProject(upsertHelloSession(sessionProject, nextSession));

    const controller = new AbortController();
    let streamedText = "";
    try {
      const result = await generateHelloChatReply({
        projectId: baseProject.id,
        mode,
        dossierMarkdown: baseProject.dossier.markdown,
        characterInfoYaml: baseProject.characterProfile?.yaml,
        confirmedEntries: baseProject.worldEntries.filter((entry) => entry.enabled),
        selectedGreeting: mode === "greeting" ? selectedGreeting : undefined,
        historyMessages: session.messages,
        userInput: text,
        signal: controller.signal,
        onDelta: (_delta, content) => {
          streamedText = content;
          setProject((current) =>
            current
              ? updateHelloMessageContent(current, nextSession.id, assistantMessage.id, content)
              : current,
          );
        },
      });

      const finalSession = {
        ...nextSession,
        messages: nextSession.messages.map((message) =>
          message.id === assistantMessage.id ? { ...message, content: result.text } : message,
        ),
        updatedAt: nowIso(),
      };
      await persistProject(upsertHelloSession(sessionProject, finalSession), "保存打招呼对话", [
        result.taskId,
      ]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "对话生成失败。");
      setProject(upsertHelloSession(sessionProject, session));
    } finally {
      void streamedText;
      setIsSending(false);
    }
  }

  function startEdit(message: HelloChatMessage) {
    if (isSending) {
      return;
    }
    setEditingMessageId(message.id);
    setEditingText(message.content);
  }

  async function confirmEdit() {
    const text = editingText.trim();
    if (!project || !currentSession || !editingMessageId || !text || isSending) {
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    const userIndex = currentSession.messages.findIndex((message) => message.id === editingMessageId);
    if (userIndex < 0) {
      return;
    }

    const now = nowIso();
    const historyMessages = currentSession.messages.slice(0, userIndex);
    const userMessage = { ...currentSession.messages[userIndex], content: text, createdAt: now };
    const assistantMessage: HelloChatMessage = {
      id: createId("msg"),
      role: "assistant",
      content: "",
      createdAt: now,
    };
    const nextSession = {
      ...currentSession,
      messages: [...historyMessages, userMessage, assistantMessage],
      updatedAt: now,
    };

    setEditingMessageId(null);
    setEditingText("");
    setErrorMessage(null);
    setIsSending(true);
    setProject(upsertHelloSession(project, nextSession));

    try {
      const result = await generateHelloChatReply({
        projectId: project.id,
        mode,
        dossierMarkdown: project.dossier.markdown,
        characterInfoYaml: project.characterProfile?.yaml,
        confirmedEntries: project.worldEntries.filter((entry) => entry.enabled),
        selectedGreeting: mode === "greeting" ? selectedGreeting : undefined,
        historyMessages,
        userInput: text,
        onDelta: (_delta, content) => {
          setProject((current) =>
            current
              ? updateHelloMessageContent(current, nextSession.id, assistantMessage.id, content)
              : current,
          );
        },
      });
      const finalSession = {
        ...nextSession,
        messages: nextSession.messages.map((message) =>
          message.id === assistantMessage.id ? { ...message, content: result.text } : message,
        ),
        updatedAt: nowIso(),
      };
      await persistProject(upsertHelloSession(project, finalSession), "重新生成打招呼回复", [
        result.taskId,
      ]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "重新生成失败。");
      setProject(project);
    } finally {
      setIsSending(false);
    }
  }

  function openRevisionDialog(message: HelloChatMessage) {
    if (!currentSession) {
      return;
    }
    setRevisionTarget({ message, session: currentSession });
    setRevisionNotes("");
    setRevisionDraft(null);
    setRevisionError(null);
  }

  function closeRevisionDialog() {
    if (isRevising) {
      return;
    }
    setRevisionTarget(null);
    setRevisionNotes("");
    setRevisionDraft(null);
    setRevisionError(null);
  }

  async function handleCreateRevision() {
    if (!project || !revisionTarget || !revisionNotes.trim()) {
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setRevisionError("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    setIsRevising(true);
    setRevisionError(null);
    try {
      const result = await generateHelloRevision({
        projectId: project.id,
        mode: revisionTarget.session.mode,
        dossierMarkdown: project.dossier.markdown,
        characterInfoYaml: project.characterProfile?.yaml,
        confirmedEntries: project.worldEntries.filter((entry) => entry.enabled),
        selectedGreeting:
          revisionTarget.session.mode === "greeting"
            ? adoptedGreetings.find((greeting) => greeting.id === revisionTarget.session.selectedGreetingId)
            : undefined,
        historyMessages: revisionTarget.session.messages,
        targetReply: revisionTarget.message.content,
        revisionNotes: revisionNotes.trim(),
      });
      setRevisionDraft(result.data);
    } catch (error) {
      setRevisionError(error instanceof Error ? error.message : "修改建议生成失败。");
    } finally {
      setIsRevising(false);
    }
  }

  async function handleApplyRevision() {
    if (!project || !revisionDraft) {
      return;
    }

    try {
      const nextProject = applyRevisionDraft(project, revisionDraft);
      await persistProject(nextProject, "根据打招呼反馈修改角色资料");
      closeRevisionDialog();
    } catch (error) {
      setRevisionError(error instanceof Error ? error.message : "保存修改失败。");
    }
  }

  if (isLoading) {
    return <div className="p-6 font-mono text-sm text-[var(--echo-muted)]">正在准备打招呼……</div>;
  }

  if (!project || !currentSession) {
    return (
      <div className="p-6">
        <EmptyState title="这里还没有 TA" description="先完成终审，才能打个招呼。" />
      </div>
    );
  }

  return (
    <main className="echo-workspace-page">
      <div className="echo-workspace-inner space-y-6">
        <section className="echo-section-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
                打个招呼
              </p>
              <h1 className="mt-3 font-display text-4xl font-black text-[var(--echo-paper)]">
                和 TA 试着聊一聊
              </h1>
              <p className="mt-3 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
                根据已完成的角色档案、角色信息和小岛背景进行对话。喜欢这位岛民后，可以带走并导出角色卡。
              </p>
            </div>
            <Button type="button" onClick={() => void handleTakeAway()}>
              <Archive aria-hidden="true" size={16} />
              带走岛民
            </Button>
          </div>
        </section>

        <section className="echo-text-card">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="对话模式">
            {(["greeting", "casual"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                className={cn(
                  "border-2 px-4 py-2 font-display text-sm font-black transition-colors",
                  mode === item
                    ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
                    : "border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] text-[var(--echo-text)] hover:border-[var(--echo-paper)]",
                )}
                onClick={() => void handleModeChange(item)}
              >
                {chatModeLabels[item]}
              </button>
            ))}
          </div>

        </section>

        <section className="echo-text-card grid h-[calc(100vh-24rem)] min-h-[460px] max-h-[720px] grid-rows-[1fr_auto] overflow-hidden p-0">
          <div ref={scrollRef} className="space-y-4 overflow-auto p-4 md:p-5">
            {currentSession.messages.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="还没有开始聊天"
                description="发出第一句话后，TA 会根据当前资料回复。"
              />
            ) : (
              currentSession.messages.map((message, index) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  mode={mode}
                  canEdit={message.id === latestEditableMessageId && !isSending}
                  canInspect={message.role === "assistant" && !message.isOpening && !isSending}
                  isOldRenderedCode={
                    mode === "greeting" &&
                    !message.isOpening &&
                    isOlderThanRenderDepth(currentSession, index)
                  }
                  beautifications={project.beautifications.filter((asset) => asset.enabled)}
                  adoptedGreetings={adoptedGreetings}
                  selectedGreetingId={selectedGreetingId}
                  isEditing={editingMessageId === message.id}
                  editingText={editingText}
                  onEditingTextChange={setEditingText}
                  onGreetingChange={(greetingId) => void handleGreetingChange(greetingId)}
                  onStartEdit={() => startEdit(message)}
                  onCancelEdit={() => {
                    setEditingMessageId(null);
                    setEditingText("");
                  }}
                  onConfirmEdit={() => void confirmEdit()}
                  onInspect={() => openRevisionDialog(message)}
                />
              ))
            )}
          </div>

          <div className="border-t-2 border-[var(--echo-line)] bg-[rgba(247,243,223,0.9)] p-4">
            {errorMessage && (
              <p className="mb-3 border border-[var(--echo-stamp)] bg-[rgba(122,43,38,0.1)] p-3 font-mono text-xs leading-6 text-[var(--echo-stamp)]">
                {errorMessage}
              </p>
            )}
            {isLimitReached ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="font-mono text-sm font-bold text-[var(--echo-muted)]">
                  已经聊了很多啦，喜欢TA就带走TA吧
                </p>
                <Button type="button" onClick={() => void handleTakeAway()}>
                  <Archive aria-hidden="true" size={16} />
                  带走岛民
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 md:flex-row">
                <textarea
                  value={inputText}
                  disabled={isSending}
                  onChange={(event) => setInputText(event.target.value)}
                  className="min-h-20 flex-1 border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.72)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--animal-primary)] disabled:opacity-60"
                  placeholder="对 TA 说点什么……"
                />
                <Button
                  type="button"
                  className="self-end"
                  loading={isSending}
                  disabled={!inputText.trim() || isSending}
                  onClick={() => void handleSend()}
                >
                  <Send aria-hidden="true" size={16} />
                  发送
                </Button>
              </div>
            )}
            <p className="mt-3 font-mono text-xs text-[var(--echo-muted)]">
              当前 {roundCount}/{maxRounds} 轮
            </p>
          </div>
        </section>
      </div>

      <RevisionDialog
        target={revisionTarget}
        notes={revisionNotes}
        draft={revisionDraft}
        errorMessage={revisionError}
        isLoading={isRevising}
        onNotesChange={setRevisionNotes}
        onCreateRevision={() => void handleCreateRevision()}
        onApplyRevision={() => void handleApplyRevision()}
        onClose={closeRevisionDialog}
      />
    </main>
  );
}

function ChatBubble({
  message,
  mode,
  canEdit,
  canInspect,
  isOldRenderedCode,
  beautifications,
  adoptedGreetings,
  selectedGreetingId,
  isEditing,
  editingText,
  onEditingTextChange,
  onGreetingChange,
  onStartEdit,
  onCancelEdit,
  onConfirmEdit,
  onInspect,
}: {
  message: HelloChatMessage;
  mode: HelloChatMode;
  canEdit: boolean;
  canInspect: boolean;
  isOldRenderedCode: boolean;
  beautifications: Project["beautifications"];
  adoptedGreetings: GreetingVariant[];
  selectedGreetingId?: string;
  isEditing: boolean;
  editingText: string;
  onEditingTextChange: (value: string) => void;
  onGreetingChange: (greetingId: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onConfirmEdit: () => void;
  onInspect: () => void;
}) {
  const isUser = message.role === "user";
  const renderedContent = applyHelloBeautificationsForPreview(message.content, beautifications);
  const shouldRender =
    mode === "greeting" &&
    !isUser &&
    !isOldRenderedCode &&
    (renderedContent.didReplace || hasHtmlLikeContent(renderedContent.content));

  return (
    <article className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <Avatar label="TA" />}
      <div className={cn(isUser ? "order-first max-w-[min(780px,84%)]" : "max-w-[min(980px,92%)]")}>
        <div
          className={cn(
            "border-2 p-3 shadow-[0_3px_0_0_var(--animal-shadow-input)]",
            isUser
              ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
              : "border-[var(--echo-line)] bg-[rgba(255,255,255,0.62)] text-[var(--echo-text)]",
          )}
        >
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editingText}
                onChange={(event) => onEditingTextChange(event.target.value)}
                className="min-h-24 w-full border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.76)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--animal-primary)]"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
                  <X aria-hidden="true" size={14} />
                  取消
                </Button>
                <Button type="button" size="sm" onClick={onConfirmEdit}>
                  <Check aria-hidden="true" size={14} />
                  确定
                </Button>
              </div>
            </div>
          ) : shouldRender ? (
            <RenderedReply content={renderedContent.content} />
          ) : (
            <p
              className={cn(
                "echo-long-text whitespace-pre-wrap font-mono text-sm leading-7",
                mode === "greeting" && !isUser && isOldRenderedCode && "overflow-auto",
              )}
            >
              {message.content || "正在输入……"}
            </p>
          )}
        </div>
        {message.isOpening && adoptedGreetings.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {adoptedGreetings.map((greeting, index) => (
              <button
                key={greeting.id}
                type="button"
                className={cn(
                  "border px-3 py-1.5 font-mono text-xs font-bold transition-colors",
                  selectedGreetingId === greeting.id
                    ? "border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] text-[var(--animal-text)]"
                    : "border-[var(--echo-line)] bg-[rgba(247,243,223,0.86)] text-[var(--echo-muted)] hover:text-[var(--echo-text)]",
                )}
                onClick={() => onGreetingChange(greeting.id)}
              >
                开场白 {index + 1}
              </button>
            ))}
          </div>
        )}
        {(canEdit || canInspect) && (
          <div className={cn("mt-2 flex gap-2", isUser ? "justify-end" : "justify-start")}>
            {canEdit && (
              <button
                type="button"
                aria-label="修改这条消息"
                className="border border-[var(--echo-line)] bg-[rgba(247,243,223,0.86)] p-2 text-[var(--echo-muted)] hover:text-[var(--echo-paper)]"
                onClick={onStartEdit}
              >
                <Pencil aria-hidden="true" size={15} />
              </button>
            )}
            {canInspect && (
              <button
                type="button"
                aria-label="检查并修复这条回复"
                className="border border-[var(--echo-line)] bg-[rgba(247,243,223,0.86)] p-2 text-[var(--echo-muted)] hover:text-[var(--echo-paper)]"
                onClick={onInspect}
              >
                <Search aria-hidden="true" size={15} />
              </button>
            )}
          </div>
        )}
      </div>
      {isUser && <Avatar label="UU" />}
    </article>
  );
}

function Avatar({ label }: { label: "TA" | "UU" }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] font-display text-sm font-black text-[var(--animal-primary)] shadow-[0_3px_0_0_var(--animal-shadow-input)]">
      {label}
    </div>
  );
}

function RenderedReply({ content }: { content: string }) {
  const frameId = useMemo(() => createId("hello_frame"), []);
  const [height, setHeight] = useState(180);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as { type?: string; frameId?: string; height?: number } | null;
      if (
        data?.type !== "echo-hello-frame-height" ||
        data.frameId !== frameId ||
        typeof data.height !== "number"
      ) {
        return;
      }
      setHeight(Math.max(120, Math.ceil(data.height)));
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [frameId]);

  return (
    <iframe
      title="TA 的回复渲染"
      srcDoc={buildRenderedDocument(content, frameId)}
      sandbox="allow-scripts"
      style={{ height }}
      className="block w-full border-0 bg-transparent"
    />
  );
}

function RevisionDialog({
  target,
  notes,
  draft,
  errorMessage,
  isLoading,
  onNotesChange,
  onCreateRevision,
  onApplyRevision,
  onClose,
}: {
  target: RevisionTarget | null;
  notes: string;
  draft: RevisionDraft | null;
  errorMessage: string | null;
  isLoading: boolean;
  onNotesChange: (value: string) => void;
  onCreateRevision: () => void;
  onApplyRevision: () => void;
  onClose: () => void;
}) {
  if (!target) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(61,52,40,0.45)] p-4">
      <section className="max-h-[88vh] w-full max-w-3xl overflow-auto border-2 border-[var(--echo-line)] bg-[var(--animal-bg-content)] p-5 shadow-[0_8px_24px_rgba(61,52,40,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-black text-[var(--echo-paper)]">
              检查并修复回复
            </h2>
            <p className="mt-2 font-mono text-sm leading-6 text-[var(--echo-muted)]">
              写下问题后，AI 会返回资料修改建议。确认前不会保存。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="border-2 border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-2 text-[var(--echo-text)]"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="mt-4">
          <Collapse
            question={
              <span className="font-mono text-sm font-bold text-[var(--animal-text)]">
                当前回复
              </span>
            }
            answer={
              <p className="echo-long-text whitespace-pre-wrap pt-3 font-mono text-sm leading-6 text-[var(--echo-text)]">
                {target.message.content}
              </p>
            }
          />
        </div>

        <label className="mt-4 block">
          <span className="font-mono text-xs font-bold text-[var(--echo-muted)]">
            修改意见或不满意原因
          </span>
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            className="mt-2 min-h-28 w-full border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.68)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--animal-primary)]"
            placeholder="例如：这段回复 OOC 了；TA 不应该这么快信任 {{user}}。"
          />
        </label>

        {errorMessage && (
          <p className="mt-3 border border-[var(--echo-stamp)] bg-[rgba(122,43,38,0.1)] p-3 font-mono text-xs leading-6 text-[var(--echo-stamp)]">
            {errorMessage}
          </p>
        )}

        {draft && (
          <section className="mt-5 space-y-3">
            <h3 className="font-display text-xl font-black text-[var(--echo-paper)]">
              {draft.summary}
            </h3>
            {draft.changes.map((change, index) => (
              <article
                key={`${change.source}-${change.title}-${index}`}
                className="border border-[var(--echo-line)] bg-[rgba(255,255,255,0.45)] p-4"
              >
                <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">
                  {sourceLabels[change.source]} · {change.title}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">修改前</p>
                    <p className="echo-long-text mt-2 border border-[var(--echo-line)] bg-[rgba(247,243,223,0.88)] p-3 font-mono text-xs text-[var(--echo-text)]">
                      {change.before}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs font-bold text-[var(--echo-muted)]">修改后</p>
                    <p className="echo-long-text mt-2 border border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] p-3 font-mono text-xs text-[var(--animal-text)]">
                      {change.after}
                    </p>
                  </div>
                </div>
                <p className="mt-3 font-mono text-xs leading-5 text-[var(--echo-muted)]">
                  {change.reason}
                </p>
              </article>
            ))}
          </section>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            取消
          </Button>
          {!draft ? (
            <Button
              type="button"
              loading={isLoading}
              disabled={!notes.trim() || isLoading}
              onClick={onCreateRevision}
            >
              检查并修复
            </Button>
          ) : (
            <Button type="button" onClick={onApplyRevision}>
              确认并保存
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function getOrCreateSession(
  project: Project,
  mode: HelloChatMode,
  selectedGreeting: GreetingVariant | undefined,
  options: { persist: boolean },
) {
  const existing = (project.helloSessions ?? []).find((session) => {
    if (session.mode !== mode) {
      return false;
    }
    if (mode === "greeting") {
      return session.selectedGreetingId === selectedGreeting?.id;
    }
    return true;
  });

  if (existing) {
    return { project, session: existing };
  }

  const now = nowIso();
  const session: HelloChatSession = {
    id: createId("hello"),
    projectId: project.id,
    mode,
    selectedGreetingId: mode === "greeting" ? selectedGreeting?.id : undefined,
    messages:
      mode === "greeting" && selectedGreeting
        ? [
            {
              id: createId("msg"),
              role: "assistant",
              content: selectedGreeting.content,
              createdAt: now,
              greetingId: selectedGreeting.id,
              isOpening: true,
            },
          ]
        : [],
    createdAt: now,
    updatedAt: now,
  };

  return {
    project: options.persist ? upsertHelloSession(project, session) : project,
    session,
  };
}

function upsertHelloSession(project: Project, session: HelloChatSession): Project {
  const sessions = project.helloSessions ?? [];
  const exists = sessions.some((item) => item.id === session.id);
  return {
    ...project,
    helloSessions: exists
      ? sessions.map((item) => (item.id === session.id ? session : item))
      : [session, ...sessions],
    updatedAt: nowIso(),
  };
}

function updateHelloMessageContent(
  project: Project,
  sessionId: string,
  messageId: string,
  content: string,
) {
  return {
    ...project,
    helloSessions: (project.helloSessions ?? []).map((session) =>
      session.id === sessionId
        ? {
            ...session,
            messages: session.messages.map((message) =>
              message.id === messageId ? { ...message, content } : message,
            ),
          }
        : session,
    ),
  };
}

function countUserRounds(session: HelloChatSession) {
  return session.messages.filter((message) => message.role === "user").length;
}

function getLatestEditableUserMessageId(session: HelloChatSession) {
  const messages = session.messages;
  if (messages.length < 2) {
    return null;
  }
  const last = messages[messages.length - 1];
  const previous = messages[messages.length - 2];
  return previous?.role === "user" && last?.role === "assistant" && last.content.trim()
    ? previous.id
    : null;
}

function isOlderThanRenderDepth(session: HelloChatSession, index: number) {
  const lastFourIndexes = session.messages.slice(-4).map((_, offset) => session.messages.length - 4 + offset);
  return !lastFourIndexes.includes(index);
}

function buildRenderedDocument(body: string, frameId: string) {
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
      padding: 0;
      box-sizing: border-box;
      white-space: pre-wrap;
      overflow: hidden;
    }
    details {
      width: min(100%, 760px);
      margin: 0 auto 12px;
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
<script>
  (() => {
    const frameId = ${JSON.stringify(frameId)};
    const report = () => {
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      );
      window.parent.postMessage({ type: "echo-hello-frame-height", frameId, height: height + 8 }, "*");
    };
    window.addEventListener("load", report);
    requestAnimationFrame(report);
    setTimeout(report, 80);
    setTimeout(report, 260);
  })();
</script>
</body>
</html>`;
}

function applyRevisionDraft(project: Project, draft: RevisionDraft) {
  const now = nowIso();
  let dossierMarkdown = project.dossier.markdown;
  let characterInfoYaml = project.characterProfile?.yaml ?? "";
  let worldEntries = project.worldEntries;
  let greetingVariants = project.greetingVariants;
  let appliedCount = 0;

  for (const change of draft.changes) {
    if (change.source === "dossier" && dossierMarkdown.includes(change.before)) {
      dossierMarkdown = dossierMarkdown.replace(change.before, change.after);
      appliedCount += 1;
    }

    if (change.source === "character_info" && characterInfoYaml.includes(change.before)) {
      characterInfoYaml = characterInfoYaml.replace(change.before, change.after);
      appliedCount += 1;
    }

    if (change.source === "worldinfo") {
      let didApply = false;
      worldEntries = worldEntries.map((entry) => {
        if (didApply) {
          return entry;
        }
        const isTarget = change.targetId
          ? entry.id === change.targetId
          : entry.content.includes(change.before);
        if (!isTarget || !entry.content.includes(change.before)) {
          return entry;
        }
        didApply = true;
        appliedCount += 1;
        return {
          ...entry,
          content: entry.content.replace(change.before, change.after),
          updatedAt: now,
        };
      });
    }

    if (change.source === "greeting") {
      let didApply = false;
      greetingVariants = greetingVariants.map((variant) => {
        if (didApply) {
          return variant;
        }
        const isTarget = change.targetId
          ? variant.id === change.targetId
          : variant.content.includes(change.before);
        if (!isTarget || !variant.content.includes(change.before)) {
          return variant;
        }
        didApply = true;
        appliedCount += 1;
        return {
          ...variant,
          content: variant.content.replace(change.before, change.after),
          updatedAt: now,
        };
      });
    }
  }

  if (appliedCount === 0) {
    throw new Error("没有找到可替换的原文，请重新生成修改建议。");
  }

  return {
    ...project,
    dossier: {
      ...project.dossier,
      markdown: dossierMarkdown,
      blocks:
        dossierMarkdown === project.dossier.markdown
          ? project.dossier.blocks
          : buildDossierBlockMeta(dossierMarkdown, project.dossier.blocks, "ai_inferred", now),
      updatedAt: dossierMarkdown === project.dossier.markdown ? project.dossier.updatedAt : now,
    },
    characterProfile: project.characterProfile
      ? {
          ...project.characterProfile,
          yaml: characterInfoYaml,
          updatedAt:
            characterInfoYaml === project.characterProfile.yaml
              ? project.characterProfile.updatedAt
              : now,
        }
      : project.characterProfile,
    worldEntries,
    greetingVariants,
    updatedAt: now,
  } satisfies Project;
}

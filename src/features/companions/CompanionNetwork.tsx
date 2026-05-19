import mermaid from "mermaid";
import { GitBranch, Plus, Trash2, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { CompanionNode, Project } from "@/db/types";
import { projectService } from "@/db/services/projectService";
import {
  buildRelationMermaid,
  confirmCompanion,
  createCompanionCandidates,
} from "@/features/companions/companionStore";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";
import { Button } from "@/shared/components/ui/button";

interface CompanionNetworkProps {
  project: Project;
  onProjectChange: (project: Project) => void;
}

function createManualNode(project: Project): CompanionNode {
  const now = nowIso();

  return {
    id: createId("npc"),
    projectId: project.id,
    name: "未命名的旁人",
    role: "关系未明",
    summary: "TA 在主角生活的边缘留下过一枚很浅的印记。",
    personality: "尚待辨认。",
    relationToMain: "这段关系还没有被说清。",
    status: "candidate",
    createdAt: now,
    updatedAt: now,
  };
}

export function CompanionNetwork({ project, onProjectChange }: CompanionNetworkProps) {
  const [userRequest, setUserRequest] = useState("寻找一个知道 TA 旧伤的人。");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [mermaidSvg, setMermaidSvg] = useState("");
  const [fragment, setFragment] = useState("");
  const [exclusions, setExclusions] = useState<string[]>([]);
  const graphDefinition = useMemo(() => buildRelationMermaid(project), [project]);

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "loose" });
    mermaid
      .render(`echo-relation-${project.id.replace(/\W/g, "")}`, graphDefinition)
      .then((result) => {
        if (!cancelled) {
          setMermaidSvg(result.svg);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMermaidSvg("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [graphDefinition, project.id]);

  async function persist(nextProject: Project) {
    const { id, createdAt, ...patch } = nextProject;
    void createdAt;
    const saved = await projectService.updateProject(id, patch);
    if (saved) {
      onProjectChange(saved);
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setError("");
    try {
      const result = await createCompanionCandidates(project, userRequest);
      setFragment(result.fragment);
      setExclusions(result.exclusions.map((item) => `${item.title}：${item.reason}`));
      await persist({
        ...project,
        companions: [...result.nodes, ...(project.companions ?? [])],
        companionRelations: project.companionRelations ?? [],
        updatedAt: nowIso(),
      });
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "配角寻人失败。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function updateNode(nodeId: string, patch: Partial<CompanionNode>) {
    await persist({
      ...project,
      companions: (project.companions ?? []).map((node) =>
        node.id === nodeId ? { ...node, ...patch, updatedAt: nowIso() } : node,
      ),
      companionRelations: project.companionRelations ?? [],
      updatedAt: nowIso(),
    });
  }

  async function deleteNode(nodeId: string) {
    await persist({
      ...project,
      companions: (project.companions ?? []).filter((node) => node.id !== nodeId),
      companionRelations: (project.companionRelations ?? []).filter(
        (relation) => relation.fromNodeId !== nodeId && relation.toNodeId !== nodeId,
      ),
      updatedAt: nowIso(),
    });
  }

  async function handleConfirm(nodeId: string) {
    await persist(confirmCompanion(project, nodeId));
  }

  async function handleManualAdd() {
    await persist({
      ...project,
      companions: [createManualNode(project), ...(project.companions ?? [])],
      companionRelations: project.companionRelations ?? [],
      updatedAt: nowIso(),
    });
  }

  return (
    <section className="border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-muted)]">
            阶段 16
          </p>
          <h2 className="mt-2 font-display text-3xl font-black text-[var(--echo-paper)]">
            关系网与配角微型寻人
          </h2>
          <p className="mt-2 max-w-3xl font-mono text-sm leading-7 text-[var(--echo-muted)]">
            围绕主角辨认旁人，用三道剪影、两次排除和一枚碎片确认关系。
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void handleManualAdd()}>
          <Plus aria-hidden="true" size={18} />
          手动添加
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <label className="grid gap-2 text-sm font-bold text-[var(--echo-paper)]">
            这次想寻找谁
            <textarea
              value={userRequest}
              onChange={(event) => setUserRequest(event.target.value)}
              rows={4}
              className="resize-y border-2 border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
            />
          </label>
          <Button type="button" loading={isGenerating} disabled={isGenerating} onClick={() => void handleGenerate()}>
            {isGenerating ? null : <GitBranch aria-hidden="true" size={18} />}
            寻找关系剪影
          </Button>
          {error && (
            <p className="border border-[var(--echo-stamp)] bg-[rgba(120,40,34,0.18)] p-3 font-mono text-sm text-[var(--echo-paper)]">
              {error}
            </p>
          )}
          {fragment && (
            <p className="border border-[var(--echo-line)] p-3 font-mono text-sm leading-6 text-[var(--echo-muted)]">
              {fragment}
            </p>
          )}
          {exclusions.length > 0 && (
            <div className="grid gap-2">
              {exclusions.map((item) => (
                <p key={item} className="border border-dashed border-[var(--echo-line)] p-2 font-mono text-xs text-[var(--echo-muted)]">
                  反例排除：{item}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3">
            <p className="font-mono text-sm font-bold text-[var(--echo-paper)]">关系图</p>
            {mermaidSvg ? (
              <div
                className="mt-3 overflow-auto"
                dangerouslySetInnerHTML={{ __html: mermaidSvg }}
              />
            ) : (
              <pre className="mt-3 overflow-auto font-mono text-xs text-[var(--echo-muted)]">
                {graphDefinition}
              </pre>
            )}
          </div>

          <div className="grid gap-3">
            {(project.companions ?? []).length ? (
              project.companions.map((node) => (
                <article key={node.id} className="border border-[var(--echo-line)] bg-[rgba(255,255,255,0.42)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        value={node.name}
                        onChange={(event) => void updateNode(node.id, { name: event.target.value })}
                        className="w-full border border-[var(--echo-line)] bg-transparent px-2 py-1 font-display text-xl font-black text-[var(--echo-paper)] outline-none focus:border-[var(--echo-paper)]"
                      />
                      <input
                        value={node.role}
                        onChange={(event) => void updateNode(node.id, { role: event.target.value })}
                        className="w-full border border-[var(--echo-line)] bg-transparent px-2 py-1 font-mono text-sm text-[var(--echo-muted)] outline-none focus:border-[var(--echo-paper)]"
                      />
                      <textarea
                        value={node.summary}
                        onChange={(event) => void updateNode(node.id, { summary: event.target.value })}
                        rows={3}
                        className="w-full resize-y border border-[var(--echo-line)] bg-transparent p-2 font-mono text-sm leading-6 text-[var(--echo-text)] outline-none focus:border-[var(--echo-paper)]"
                      />
                      <textarea
                        value={node.relationToMain}
                        onChange={(event) => void updateNode(node.id, { relationToMain: event.target.value })}
                        rows={2}
                        className="w-full resize-y border border-[var(--echo-line)] bg-transparent p-2 font-mono text-sm leading-6 text-[var(--echo-muted)] outline-none focus:border-[var(--echo-paper)]"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button type="button" size="icon" variant="secondary" onClick={() => void handleConfirm(node.id)} aria-label="确认配角">
                        <UserCheck aria-hidden="true" size={16} />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => void deleteNode(node.id)} aria-label="删除配角">
                        <Trash2 aria-hidden="true" size={16} />
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="border border-dashed border-[var(--echo-line)] p-4 font-mono text-sm text-[var(--echo-muted)]">
                还没有找到旁人。
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

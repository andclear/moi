import type { CompanionNode, CompanionRelation, Project } from "@/db/types";
import { generateCompanionCandidates } from "@/features/llm/llmClient";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export function createMainCharacterNode(project: Project): CompanionNode {
  const now = nowIso();

  return {
    id: "main",
    projectId: project.id,
    name: project.title,
    role: "主角",
    summary: "这张档案正在寻找的 TA。",
    personality: "见 TA 的回音墙。",
    relationToMain: "自我",
    status: "confirmed",
    createdAt: now,
    updatedAt: now,
  };
}

export async function createCompanionCandidates(project: Project, userRequest: string) {
  const result = await generateCompanionCandidates({
    projectId: project.id,
    dossierMarkdown: project.dossier.markdown,
    confirmedEntries: project.worldEntries.filter((entry) => entry.enabled),
    userRequest,
  });
  const now = nowIso();

  return {
    taskId: result.taskId,
    fragment: result.data.fragment,
    exclusions: result.data.exclusions,
    nodes: result.data.silhouettes.map((item) => ({
      id: createId("npc"),
      projectId: project.id,
      name: item.name,
      role: item.role,
      summary: item.summary,
      personality: item.personality,
      relationToMain: item.relationToMain,
      status: "candidate" as const,
      createdAt: now,
      updatedAt: now,
    })),
  };
}

export function confirmCompanion(project: Project, nodeId: string) {
  const now = nowIso();
  const companions = project.companions ?? [];
  const relations = project.companionRelations ?? [];
  const node = companions.find((item) => item.id === nodeId);
  if (!node) {
    return project;
  }

  const nextNode = { ...node, status: "confirmed" as const, updatedAt: now };
  const hasRelation = relations.some(
    (relation) => relation.fromNodeId === "main" && relation.toNodeId === nodeId,
  );
  const nextRelation: CompanionRelation | undefined = hasRelation
    ? undefined
    : {
        id: createId("relation"),
        projectId: project.id,
        fromNodeId: "main",
        toNodeId: node.id,
        label: node.role,
        description: node.relationToMain,
        strength: 0.72,
        createdAt: now,
        updatedAt: now,
      };

  return {
    ...project,
    companions: companions.map((item) => (item.id === node.id ? nextNode : item)),
    companionRelations: nextRelation
      ? [nextRelation, ...relations]
      : relations,
    updatedAt: now,
  };
}

export function buildRelationMermaid(project: Project) {
  const nodes = [createMainCharacterNode(project), ...(project.companions ?? [])];
  const lines = ["graph LR"];
  nodes.forEach((node) => {
    lines.push(`  ${node.id.replace(/\W/g, "_")}["${node.name}<br/>${node.role}"]`);
  });
  (project.companionRelations ?? []).forEach((relation) => {
    lines.push(
      `  ${relation.fromNodeId.replace(/\W/g, "_")} -- "${relation.label}" --> ${relation.toNodeId.replace(/\W/g, "_")}`,
    );
  });

  return lines.join("\n");
}

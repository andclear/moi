import type { Project, WorldEntry } from "@/db/types";
import { buildDossierBlockMeta, parseDossierSections } from "@/features/dossier/dossierSections";
import { collectPromptWorldEntries } from "@/features/world/worldPromptContext";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export interface GeneratedWorldEntryInput {
  comment: string;
  content: string;
  keys?: string[];
  constant?: boolean;
  position?: number;
  depth?: number;
  insertion_order?: number;
}

function replaceDossierSection(markdown: string, section: string, content: string) {
  const blocks = parseDossierSections(markdown);
  const hasSection = blocks.some((block) => block.section === section);
  const nextBlocks = blocks.map((block) => {
    if (block.section !== section) {
      return `## ${block.section}\n\n${block.content || "尚未听见"}`;
    }

    return `## ${block.section}\n\n${content || "尚未听见"}`;
  });

  if (!hasSection) {
    nextBlocks.push(`## ${section}\n\n${content || "尚未听见"}`);
  }

  return nextBlocks.join("\n\n");
}

export function getConfirmedWorldEntries(project: Project) {
  return collectPromptWorldEntries(project);
}

export function formatWorldInfoForDossier(entries: WorldEntry[]) {
  const confirmedEntries = entries.filter((entry) => entry.enabled);
  if (confirmedEntries.length === 0) {
    return "WorldInfo：尚未听见";
  }

  return [
    `已确认 ${confirmedEntries.length} 条 WorldInfo。`,
    "这些条目保存在世界书列表中，不在角色档案里逐条展开；完成本阶段时会由 AI 总结为角色档案中的补充信息。",
    `条目标题：${confirmedEntries.map((entry) => entry.title).join("、")}`,
  ].join("\n\n");
}

export function createWorldEntryCandidates(
  projectId: string,
  entries: GeneratedWorldEntryInput[],
  now = nowIso(),
) {
  return entries.map((entry) => {
    const keys = entry.constant ? [] : (entry.keys ?? []);

    return {
      id: createId("world"),
      projectId,
      title: entry.comment,
      content: entry.content,
      keys,
      constant: entry.constant,
      position: entry.position,
      depth: entry.depth,
      insertionOrder: entry.insertion_order,
      enabled: false,
      createdAt: now,
      updatedAt: now,
    } satisfies WorldEntry;
  });
}

export function upsertWorldEntry(project: Project, nextEntry: WorldEntry) {
  const now = nowIso();
  return {
    ...project,
    worldEntries: project.worldEntries.map((entry) =>
      entry.id === nextEntry.id ? { ...nextEntry, updatedAt: now } : entry,
    ),
    updatedAt: now,
  } satisfies Project;
}

export function removeWorldEntry(project: Project, entryId: string) {
  const now = nowIso();
  return {
    ...project,
    worldEntries: project.worldEntries.filter((entry) => entry.id !== entryId),
    updatedAt: now,
  } satisfies Project;
}

export function syncWorldInfoToDossier(project: Project, generationId?: string) {
  const now = nowIso();
  const nextMarkdown = replaceDossierSection(
    project.dossier.markdown,
    "世界观",
    formatWorldInfoForDossier(project.worldEntries),
  );

  return {
    ...project,
    dossier: {
      markdown: nextMarkdown,
      blocks: buildDossierBlockMeta(
        nextMarkdown,
        project.dossier.blocks,
        "user_confirmed",
        now,
        generationId,
      ),
      updatedAt: now,
    },
    updatedAt: now,
  } satisfies Project;
}

export function confirmWorldEntry(project: Project, entryId: string, generationId?: string) {
  void generationId;
  const now = nowIso();
  return {
    ...project,
    worldEntries: project.worldEntries.map((entry) =>
      entry.id === entryId ? { ...entry, enabled: true, updatedAt: now } : entry,
    ),
    updatedAt: now,
  } satisfies Project;
}

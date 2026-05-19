import type { Project, WorldEntry } from "@/db/types";
import {
  buildDossierBlockMeta,
  parseDossierSections,
} from "@/features/dossier/dossierSections";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export interface GeneratedWorldEntryInput {
  comment: string;
  content: string;
  keywords?: string[];
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
  return project.worldEntries.filter((entry) => entry.enabled);
}

export function formatWorldInfoForDossier(entries: WorldEntry[]) {
  const confirmedEntries = entries.filter((entry) => entry.enabled);
  if (confirmedEntries.length === 0) {
    return "WorldInfo：尚未听见";
  }

  return [
    "WorldInfo:",
    ...confirmedEntries.map((entry) => {
      const keywords = entry.keywords.length ? `\n关键词：${entry.keywords.join("、")}` : "";
      return `- ${entry.title}${keywords}\n${entry.content}`;
    }),
  ].join("\n\n");
}

export function createWorldEntryCandidates(
  projectId: string,
  entries: GeneratedWorldEntryInput[],
  now = nowIso(),
) {
  return entries.map((entry) => {
    const keys = entry.constant ? [] : (entry.keys ?? entry.keywords ?? []);

    return {
      id: createId("world"),
      projectId,
      title: entry.comment,
      content: entry.content,
      keywords: keys,
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
  const now = nowIso();
  const nextProject = {
    ...project,
    worldEntries: project.worldEntries.map((entry) =>
      entry.id === entryId ? { ...entry, enabled: true, updatedAt: now } : entry,
    ),
    updatedAt: now,
  } satisfies Project;

  return syncWorldInfoToDossier(nextProject, generationId);
}

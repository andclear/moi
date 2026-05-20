import type { DossierBlockMeta, DossierBlockSource } from "@/db/types";
import { hashText } from "@/shared/lib/hash";

export const dossierSections = [
  "核心人格",
  "外貌特征",
  "背景故事",
  "核心矛盾",
  "说话风格",
  "世界观",
  "开场白",
] as const;

export type DossierSection = (typeof dossierSections)[number];

export interface DossierSectionBlock {
  id: string;
  section: string;
  heading: string;
  content: string;
}

function createBlockId(section: string) {
  return `section:${section}`;
}

export function createDefaultDossierMarkdown(initialBrief?: string) {
  const brief = initialBrief?.trim();
  const lines: string[] = [];

  if (brief) {
    lines.push("## 最初的印象", "", brief, "");
  }

  dossierSections.forEach((section, index) => {
    if (index > 0) {
      lines.push("");
    }
    lines.push(`## ${section}`, "", "尚未听见");
  });

  return lines.join("\n");
}

export function parseDossierSections(markdown: string): DossierSectionBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: DossierSectionBlock[] = [];
  let current: { heading: string; contentLines: string[] } | null = null;

  for (const line of lines) {
    const headingMatch = /^##\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      if (current) {
        blocks.push({
          id: createBlockId(current.heading),
          section: current.heading,
          heading: current.heading,
          content: current.contentLines.join("\n").trim(),
        });
      }
      current = { heading: headingMatch[1], contentLines: [] };
      continue;
    }

    current?.contentLines.push(line);
  }

  if (current) {
    blocks.push({
      id: createBlockId(current.heading),
      section: current.heading,
      heading: current.heading,
      content: current.contentLines.join("\n").trim(),
    });
  }

  return blocks;
}

export function buildDossierBlockMeta(
  markdown: string,
  previous: DossierBlockMeta[] = [],
  source: DossierBlockSource,
  updatedAt: string,
  updatedByGenerationId?: string,
) {
  const previousById = new Map(previous.map((block) => [block.blockId, block]));

  return parseDossierSections(markdown).map((block) => {
    const existing = previousById.get(block.id);
    const contentHash = hashText(block.content);
    const didContentChange = existing?.contentHash !== contentHash;

    return {
      blockId: block.id,
      section: block.section,
      contentHash,
      source: didContentChange ? source : (existing?.source ?? source),
      locked: existing?.locked ?? false,
      updatedByGenerationId:
        didContentChange && source === "ai_inferred"
          ? updatedByGenerationId
          : existing?.updatedByGenerationId,
      updatedAt: didContentChange ? updatedAt : (existing?.updatedAt ?? updatedAt),
    } satisfies DossierBlockMeta;
  });
}

export function mergeAiDossierMarkdown(currentMarkdown: string, aiMarkdown: string) {
  const currentBlocks = parseDossierSections(currentMarkdown);
  const aiBlocks = parseDossierSections(aiMarkdown);
  const currentBySection = new Map(currentBlocks.map((block) => [block.section, block]));
  const aiBySection = new Map(aiBlocks.map((block) => [block.section, block]));
  const orderedSections = [...new Set([...currentBlocks, ...aiBlocks].map((block) => block.section))];

  return {
    markdown: orderedSections
      .map((section) => {
        const current = currentBySection.get(section);
        const ai = aiBySection.get(section);
        const selected = ai ?? current;
        return `## ${section}\n\n${selected?.content?.trim() || "尚未听见"}`;
      })
      .join("\n\n"),
  };
}

export function stripAutoWorldInfoFromDossier(markdown: string) {
  const blocks = parseDossierSections(markdown);
  let didStrip = false;
  const nextMarkdown = blocks
    .map((block) => {
      const isAutoWorldInfo =
        block.section === "世界观" &&
        (/^WorldInfo[:：]/.test(block.content) ||
          /^已确认\s+\d+\s+条\s+WorldInfo/.test(block.content) ||
          block.content.includes("这些条目保存在世界书列表中"));

      if (!isAutoWorldInfo) {
        return `## ${block.section}\n\n${block.content || "尚未听见"}`;
      }

      didStrip = true;
      return `## ${block.section}\n\n尚未听见`;
    })
    .join("\n\n");

  return {
    markdown: didStrip ? nextMarkdown : markdown,
    didStrip,
  };
}

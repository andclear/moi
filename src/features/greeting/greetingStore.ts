import type { GreetingVariant, Project } from "@/db/types";
import {
  buildDossierBlockMeta,
  parseDossierSections,
} from "@/features/dossier/dossierSections";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export type GreetingPersonType = "第一人称" | "第二人称" | "第三人称";

export const greetingPersonTypes: GreetingPersonType[] = ["第一人称", "第二人称", "第三人称"];

export interface GeneratedGreetingInput {
  title: string;
  content: string;
  atmosphere?: string;
}

function stripCotBlocks(text: string) {
  return text.replace(/<cot>[\s\S]*?<\/cot>/gi, "").trim();
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

export function isGreetingAdopted(variant: GreetingVariant) {
  return variant.adopted === true;
}

export function getGreetingSortOrder(variant: GreetingVariant, fallback: number) {
  return variant.sortOrder ?? fallback;
}

export function getAdoptedGreetingVariants(project: Project) {
  return project.greetingVariants
    .filter(isGreetingAdopted)
    .map((variant, index) => ({
      ...variant,
      sortOrder: getGreetingSortOrder(variant, index + 1),
      adopted: true,
    }))
    .sort((left, right) => (left.sortOrder ?? 999) - (right.sortOrder ?? 999));
}

function normalizeAdoptedOrder(variants: GreetingVariant[], now = nowIso()) {
  const orderMap = new Map(
    variants
      .filter(isGreetingAdopted)
      .sort((left, right) => getGreetingSortOrder(left, 999) - getGreetingSortOrder(right, 999))
      .map((variant, index) => [variant.id, index + 1]),
  );

  return variants.map((variant) => {
    const sortOrder = orderMap.get(variant.id);
    if (!sortOrder) {
      return {
        ...variant,
        selected: false,
        adopted: false,
        sortOrder: undefined,
      };
    }

    return {
      ...variant,
      adopted: true,
      selected: false,
      sortOrder,
      updatedAt: variant.updatedAt || now,
    };
  });
}

export function createGreetingCandidates(
  projectId: string,
  variants: GeneratedGreetingInput[],
  now = nowIso(),
) {
  return variants.map((variant, index) => {
    const content = stripCotBlocks(variant.content);
    return {
      id: createId("greeting"),
      projectId,
      userRole: "开场白",
      title: stripCotBlocks(variant.title) || `开场白 ${index + 1}`,
      content,
      selected: false,
      adopted: false,
      createdAt: now,
      updatedAt: now,
    } satisfies GreetingVariant;
  });
}

export function pruneUnadoptedGreetingVariants(project: Project) {
  return {
    ...project,
    greetingVariants: normalizeAdoptedOrder(project.greetingVariants.filter(isGreetingAdopted)),
  } satisfies Project;
}

export function adoptGreetingVariant(project: Project, variantId: string) {
  const now = nowIso();
  const nextVariants = normalizeAdoptedOrder(
    project.greetingVariants.map((variant) =>
      variant.id === variantId
        ? {
            ...variant,
            adopted: true,
            sortOrder: getAdoptedGreetingVariants(project).length + 1,
            updatedAt: now,
          }
        : variant,
    ),
    now,
  );
  const primary = nextVariants.find((variant) => variant.sortOrder === 1);
  const nextMarkdown = replaceDossierSection(
    project.dossier.markdown,
    "开场白",
    primary?.content ?? "尚未听见",
  );

  return {
    ...project,
    greetingVariants: nextVariants,
    dossier: {
      markdown: nextMarkdown,
      blocks: buildDossierBlockMeta(nextMarkdown, project.dossier.blocks, "user_confirmed", now),
      updatedAt: now,
    },
    updatedAt: now,
  } satisfies Project;
}

export function discardGreetingVariant(project: Project, variantId: string) {
  const now = nowIso();
  return {
    ...project,
    greetingVariants: normalizeAdoptedOrder(
      project.greetingVariants.filter((variant) => variant.id !== variantId),
      now,
    ),
    updatedAt: now,
  } satisfies Project;
}

export function setGreetingSortOrder(project: Project, variantId: string, sortOrder: number) {
  const now = nowIso();
  const adopted = getAdoptedGreetingVariants(project);
  const target = adopted.find((variant) => variant.id === variantId);
  if (!target) {
    return project;
  }

  const nextIndex = Math.max(0, Math.min(adopted.length - 1, Math.round(sortOrder) - 1));
  const reordered = adopted.filter((variant) => variant.id !== variantId);
  reordered.splice(nextIndex, 0, target);
  const orderMap = new Map(reordered.map((variant, index) => [variant.id, index + 1]));
  const nextVariants = project.greetingVariants.map((variant) => {
      const nextOrder = orderMap.get(variant.id);
    if (!nextOrder) {
      return variant;
    }

      return {
        ...variant,
        adopted: true,
        selected: false,
        sortOrder: nextOrder,
        updatedAt: now,
      };
  });
  const primary = nextVariants.find((variant) => variant.sortOrder === 1);
  const nextMarkdown = replaceDossierSection(
    project.dossier.markdown,
    "开场白",
    primary?.content ?? "尚未听见",
  );

  return {
    ...project,
    greetingVariants: nextVariants,
    dossier: {
      markdown: nextMarkdown,
      blocks: buildDossierBlockMeta(nextMarkdown, project.dossier.blocks, "user_confirmed", now),
      updatedAt: now,
    },
    updatedAt: now,
  } satisfies Project;
}

export function updateGreetingVariant(project: Project, nextVariant: GreetingVariant) {
  const now = nowIso();
  return {
    ...project,
    greetingVariants: normalizeAdoptedOrder(
      project.greetingVariants.map((variant) =>
        variant.id === nextVariant.id ? { ...nextVariant, updatedAt: now } : variant,
      ),
      now,
    ),
    updatedAt: now,
  } satisfies Project;
}

export const removeCotBlocksFromGreeting = stripCotBlocks;

import type { GreetingVariant, Project } from "@/db/types";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export type GreetingPersonType = "第一人称" | "第二人称" | "第三人称";

export const greetingPersonTypes: GreetingPersonType[] = ["第一人称", "第二人称", "第三人称"];

export interface GeneratedGreetingInput {
  content: string;
}

export const greetingTextSeparator = "---GREETING---";

function stripCotBlocks(text: string) {
  return text.replace(/<cot>[\s\S]*?<\/cot>/gi, "").trim();
}

export function readCharacterNameFromYaml(characterInfoYaml?: string) {
  const yaml = characterInfoYaml?.trim();
  if (!yaml) {
    return "";
  }

  const match = /^姓名:\s*(.+)$/m.exec(yaml);
  const name = match?.[1]?.trim().replace(/^["'“”‘’]|["'“”‘’]$/g, "") ?? "";
  return name && !name.includes("{{char}}") ? name : "";
}

export function applyCharacterNameToGreetingText(text: string, characterInfoYaml?: string) {
  const characterName = readCharacterNameFromYaml(characterInfoYaml);
  return characterName ? text.replace(/\{\{char\}\}/g, characterName) : text;
}

export function parseGreetingResponseText(text: string): GeneratedGreetingInput[] {
  const cleaned = stripCotBlocks(text);
  const separatorPattern = new RegExp(`^\\s*${greetingTextSeparator}\\s*$`, "gim");
  const separatedParts = cleaned
    .split(separatorPattern)
    .map((part) => part.trim())
    .filter(Boolean);

  if (separatedParts.length > 1) {
    return separatedParts.map((content) => ({ content }));
  }

  const numberedParts = cleaned
    .split(/\n(?=\s*\d+[.、)]\s+)/g)
    .map((part) => part.replace(/^\s*\d+[.、)]\s+/, "").trim())
    .filter(Boolean);

  const parts = numberedParts.length > 1 ? numberedParts : [cleaned].filter(Boolean);
  return parts.map((content) => ({ content }));
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
  return variants.map((variant) => {
    const content = stripCotBlocks(variant.content);
    return {
      id: createId("greeting"),
      projectId,
      userRole: "开场白",
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

  return {
    ...project,
    greetingVariants: nextVariants,
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

  return {
    ...project,
    greetingVariants: nextVariants,
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

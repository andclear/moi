import type { GreetingVariant, Project } from "@/db/types";
import {
  buildDossierBlockMeta,
  parseDossierSections,
} from "@/features/dossier/dossierSections";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export type GreetingRoleTone = "stranger" | "client" | "old_friend" | "enemy";
export type GreetingPersonType = "第一人称" | "第二人称" | "第三人称";

export const greetingRoleLabels = {
  stranger: "陌生人",
  client: "委托人",
  old_friend: "老友",
  enemy: "敌人",
} satisfies Record<GreetingRoleTone, string>;

export const greetingPersonTypes: GreetingPersonType[] = ["第一人称", "第二人称", "第三人称"];

export interface GeneratedGreetingInput {
  title: string;
  content: string;
  atmosphere?: string;
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

export function createGreetingCandidates(
  projectId: string,
  userRole: GreetingRoleTone,
  variants: GeneratedGreetingInput[],
  now = nowIso(),
) {
  return variants.map((variant) => {
    return {
      id: createId("greeting"),
      projectId,
      userRole: greetingRoleLabels[userRole],
      title: variant.title,
      content: variant.atmosphere
        ? `${variant.content}\n\n氛围：${variant.atmosphere}`
        : variant.content,
      selected: false,
      createdAt: now,
      updatedAt: now,
    } satisfies GreetingVariant;
  });
}

export function selectGreetingVariant(project: Project, variantId: string) {
  const now = nowIso();
  const selectedVariant = project.greetingVariants.find((variant) => variant.id === variantId);
  const nextVariants = project.greetingVariants.map((variant) => ({
    ...variant,
    selected: variant.id === variantId,
    updatedAt: variant.id === variantId ? now : variant.updatedAt,
  }));
  const nextMarkdown = replaceDossierSection(
    project.dossier.markdown,
    "开场白",
    selectedVariant?.content ?? "尚未听见",
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
    greetingVariants: project.greetingVariants.map((variant) =>
      variant.id === nextVariant.id ? { ...nextVariant, updatedAt: now } : variant,
    ),
    updatedAt: now,
  } satisfies Project;
}

import type {
  BeautificationAsset,
  CompanionNode,
  CompanionRelation,
  DossierBlockMeta,
  GreetingVariant,
  Project,
  WorldEntry,
} from "@/db/types";
import type { CharacterCard } from "@/schemas/characterCardSchema";
import { characterCardSchema } from "@/schemas/characterCardSchema";
import { parseDossierSections } from "@/features/dossier/dossierSections";
import { getBeautificationWorldEntryId } from "@/features/world/worldPromptContext";
import { stripRuntimeTimestamps } from "@/shared/lib/jsonSanitizer";

export interface BuildCharacterCardInput {
  project: Project;
  versionLabel?: string;
  creator?: string;
  exportedAt?: string;
}

type ExportWorldEntry = Pick<
  WorldEntry,
  "title" | "content" | "keys" | "constant" | "position" | "depth" | "insertionOrder" | "enabled"
>;

function getSection(markdown: string, section: string) {
  return parseDossierSections(markdown).find((block) => block.section === section)?.content.trim() ?? "";
}

function normalizeText(value: string, fallback = "") {
  const next = value.trim();
  return next && next !== "尚未听见" ? next : fallback;
}

function isAdoptedGreeting(greeting: GreetingVariant) {
  return greeting.adopted === true;
}

function adoptedGreetings(greetings: GreetingVariant[]) {
  const adopted = greetings.filter((item) => item.content.trim() && isAdoptedGreeting(item));
  return adopted.sort((left, right) => {
    const leftOrder = left.sortOrder ?? 999;
    const rightOrder = right.sortOrder ?? 999;
    return leftOrder - rightOrder;
  });
}

function primaryGreeting(greetings: GreetingVariant[]) {
  return adoptedGreetings(greetings)[0];
}

function buildWorldEntry(entry: ExportWorldEntry, index: number) {
  const keys = entry.keys.length > 0 ? entry.keys : [entry.title].filter(Boolean);
  const position = entry.position ?? 1;
  const depth = entry.depth ?? 4;

  return {
    id: index,
    keys,
    secondary_keys: [],
    comment: entry.title,
    content: entry.content,
    constant: entry.constant ?? false,
    selective: keys.length > 0,
    insertion_order: entry.insertionOrder ?? 100 + index,
    enabled: entry.enabled,
    position,
    use_regex: false,
    extensions: {
      position,
      exclude_recursion: false,
      display_index: index,
      probability: 100,
      useProbability: true,
      depth,
      selectiveLogic: 0,
      outlet_name: "",
      group: "",
      group_override: false,
      group_weight: 100,
      prevent_recursion: false,
      delay_until_recursion: false,
      scan_depth: null,
      match_whole_words: null,
      use_group_scoring: false,
      case_sensitive: null,
      automation_id: "",
      role: 0,
      vectorized: false,
      sticky: null,
      cooldown: null,
      delay: null,
      match_persona_description: false,
      match_character_description: true,
      match_character_personality: false,
      match_character_depth_prompt: false,
      match_scenario: true,
      match_creator_notes: false,
      triggers: [],
      ignore_budget: false,
    },
  };
}

function buildSyntheticWorldEntry(input: {
  title: string;
  content: string;
  keys: string[];
  constant?: boolean;
  position?: number;
  depth?: number | "";
  insertionOrder?: number;
  index: number;
  category: "beautification" | "companion";
}) {
  return {
    ...buildWorldEntry(
      {
        title: input.title,
        content: input.content,
        keys: input.keys,
        constant: input.constant,
        position: input.position,
        depth: typeof input.depth === "number" ? input.depth : undefined,
        insertionOrder: input.insertionOrder,
        enabled: true,
      },
      input.index,
    ),
    extensions: {
      ...buildWorldEntry(
        {
          title: input.title,
          content: input.content,
          keys: input.keys,
          constant: input.constant,
          position: input.position,
          depth: typeof input.depth === "number" ? input.depth : undefined,
          insertionOrder: input.insertionOrder,
          enabled: true,
        },
        input.index,
      ).extensions,
      echo_category: input.category,
    },
  };
}

function buildRegexScript(asset: BeautificationAsset) {
  return {
    id: asset.id,
    scriptName: asset.regexTitle || asset.title,
    findRegex: asset.regex,
    replaceString: asset.html,
    disabled: false,
    placement: [2],
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: true,
    minDepth: null,
    maxDepth: null,
    trimStrings: [],
    substituteRegex: 0,
  };
}

function buildCompanionWorldInfo(node: CompanionNode, relations: CompanionRelation[]) {
  const relationLines = relations
    .filter((relation) => relation.fromNodeId === node.id || relation.toNodeId === node.id)
    .map((relation) => `- ${relation.label}：${relation.description}`);

  return [
    `【配角】：${node.name}`,
    `身份：${node.role}`,
    `性格：${node.personality}`,
    `与主角的关系：${node.relationToMain}`,
    `存在痕迹：${node.summary}`,
    relationLines.length ? `关系边：\n${relationLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEchoExtension(project: Project, dossierMetadata: DossierBlockMeta[], exportedAt: string) {
  return {
    project_id: project.id,
    current_step: project.currentStep,
    dossier_markdown: project.dossier.markdown,
    dossier_metadata: dossierMetadata.map((block) => ({
      block_id: block.blockId,
      section: block.section,
      content_hash: block.contentHash,
      source: block.source,
      locked: block.locked,
      updated_by_generation_id: block.updatedByGenerationId,
    })),
    trial_runs: project.trialRuns,
    beautifications: project.beautifications ?? [],
    companions: project.companions ?? [],
    companion_relations: project.companionRelations ?? [],
    exported_at: exportedAt,
  };
}

export function buildCharacterCard({
  project,
  versionLabel,
  creator,
  exportedAt = new Date().toISOString(),
}: BuildCharacterCardInput): CharacterCard {
  const markdown = project.dossier.markdown;
  const title = normalizeText(project.title, "未命名的回音");
  const core = normalizeText(getSection(markdown, "核心人格"));
  const appearance = normalizeText(getSection(markdown, "外貌特征"));
  const background = normalizeText(getSection(markdown, "背景故事"));
  const conflict = normalizeText(getSection(markdown, "核心矛盾"));
  const speech = normalizeText(getSection(markdown, "说话风格"));
  const world = normalizeText(getSection(markdown, "世界观"));
  const greeting = primaryGreeting(project.greetingVariants);
  const firstMes = normalizeText(greeting?.content ?? getSection(markdown, "开场白"), "{{char}}终于看见了{{user}}。");
  const fallbackDescription = [core, appearance, background, conflict, speech].filter(Boolean).join("\n\n");
  const fallbackPersonality = [core, conflict, speech].filter(Boolean).join("\n\n");
  const completion = project.exportDraft?.cardCompletion;
  const description = normalizeText(completion?.description ?? "", fallbackDescription);
  const personality = normalizeText(completion?.personality ?? "", fallbackPersonality);
  const tags = completion?.tags?.length ? completion.tags : ["回音", "Echo"];
  const creatorName = normalizeText(creator ?? project.exportDraft?.creator ?? "", "Echo");
  const creatorNotes = markdown;
  const alternateGreetings = adoptedGreetings(project.greetingVariants)
    .filter((item) => item.id !== greeting?.id)
    .map((item) => item.content.trim());
  const worldEntries = project.worldEntries.filter((entry) => entry.enabled);
  const beautifications = project.beautifications ?? [];
  const worldEntryIds = new Set(worldEntries.map((entry) => entry.id));
  const beautificationWorldEntries = beautifications
    .filter((asset) => asset.worldInfo && !worldEntryIds.has(getBeautificationWorldEntryId(asset.id)))
    .map((asset, index) =>
      buildSyntheticWorldEntry({
        title: asset.worldInfo?.comment ?? asset.title,
        content: asset.worldInfo?.content ?? "",
        keys: asset.worldInfo?.constant ? [] : asset.worldInfo?.keys ?? [asset.title],
        constant: asset.worldInfo?.constant,
        position: asset.worldInfo?.position,
        depth: asset.worldInfo?.depth,
        insertionOrder: asset.worldInfo?.insertion_order,
        index: worldEntries.length + index,
        category: "beautification",
      }),
    );
  const confirmedCompanions = (project.companions ?? []).filter((node) => node.status === "confirmed");
  const companionWorldEntries = confirmedCompanions.map((node, index) =>
    buildSyntheticWorldEntry({
      title: `配角关系：${node.name}`,
      content: buildCompanionWorldInfo(node, project.companionRelations ?? []),
      keys: [node.name, node.role].filter(Boolean),
      index: worldEntries.length + beautificationWorldEntries.length + index,
      category: "companion",
    }),
  );
  const card = {
    name: title,
    description,
    personality,
    scenario: world,
    first_mes: firstMes,
    mes_example: "",
    creatorcomment: creatorNotes,
    avatar: "none",
    talkativeness: "0.5",
    fav: false,
    tags,
    spec: "chara_card_v3" as const,
    spec_version: "3.0" as const,
    create_date: new Date(exportedAt).toLocaleString("zh-CN", { hour12: false }),
    data: {
      name: title,
      description,
      personality,
      scenario: world,
      first_mes: firstMes,
      mes_example: "",
      creator_notes: creatorNotes,
      system_prompt:
        "你将扮演{{char}}。保持角色已有经历、欲望、边界和说话方式，不替{{user}}做决定，不描写{{user}}的内心。",
      post_history_instructions: "持续遵守角色记录中用户确认的事实，避免突然改变人格、关系或世界逻辑。",
      tags,
      creator: creatorName,
      character_version: versionLabel ?? "1.0",
      alternate_greetings: alternateGreetings,
      character_book: {
        name: title,
        description: "由 Echo 寻回并经用户确认的世界书条目。",
        scan_depth: 2,
        token_budget: 2048,
        recursive_scanning: true,
        extensions: {},
        entries: [
          ...worldEntries.map(buildWorldEntry),
          ...beautificationWorldEntries,
          ...companionWorldEntries,
        ],
      },
      extensions: {
        talkativeness: "0.5",
        fav: false,
        world: title,
        depth_prompt: {
          prompt: "",
          depth: 4,
          role: "system" as const,
        },
        regex_scripts: beautifications.map(buildRegexScript),
        echo: buildEchoExtension(project, project.dossier.blocks, exportedAt),
      },
      group_only_greetings: [],
    },
  };

  return characterCardSchema.parse(stripRuntimeTimestamps(card));
}

export function formatCharacterCardJson(card: CharacterCard) {
  return JSON.stringify(stripRuntimeTimestamps(card), null, 2);
}

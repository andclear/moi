import type {
  BeautificationAsset,
  GreetingVariant,
  Project,
  WorldEntry,
} from "@/db/types";
import type { CharacterCard } from "@/schemas/characterCardSchema";
import { characterCardSchema } from "@/schemas/characterCardSchema";
import { parseDossierSections } from "@/features/dossier/dossierSections";
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
  const keys = entry.keys;
  const position = entry.position ?? 1;
  const depth = entry.depth ?? 4;

  return {
    id: index,
    keys,
    secondary_keys: [],
    comment: entry.title,
    content: entry.content,
    constant: entry.constant ?? false,
    selective: !entry.constant && keys.length > 0,
    insertion_order: entry.insertionOrder ?? 100 + index,
    enabled: entry.enabled,
    position: String(position),
    use_regex: true,
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
      delay_until_recursion: 0,
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
      match_character_description: false,
      match_character_personality: false,
      match_character_depth_prompt: false,
      match_scenario: false,
      match_creator_notes: false,
      triggers: [],
      ignore_budget: false,
    },
  };
}

function buildRegexScript(asset: BeautificationAsset) {
  return {
    id: asset.id,
    scriptName: asset.regexTitle || asset.title,
    findRegex: asset.regex,
    replaceString: asset.html,
    trimStrings: [],
    placement: [1, 2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
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
    data: {
      name: title,
      description,
      personality,
      scenario: world,
      first_mes: firstMes,
      mes_example: "",
      creator_notes: creatorNotes,
      tags,
      creator: creatorName,
      character_version: versionLabel ?? "1.0",
      alternate_greetings: alternateGreetings,
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
      },
      group_only_greetings: [],
      character_book: {
        entries: worldEntries.map(buildWorldEntry),
        name: title,
      },
    },
    create_date: new Date(exportedAt).toLocaleString("zh-CN", { hour12: false }),
  };

  return characterCardSchema.parse(stripRuntimeTimestamps(card));
}

export function formatCharacterCardJson(card: CharacterCard) {
  return JSON.stringify(stripRuntimeTimestamps(card), null, 2);
}

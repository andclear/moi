import type { DossierBlockMeta, GreetingVariant, Project, TrialRun, WorldEntry } from "@/db/types";
import type { CharacterCard } from "@/schemas/characterCardSchema";
import { characterCardSchema } from "@/schemas/characterCardSchema";
import { parseDossierSections } from "@/features/dossier/dossierSections";

export interface BuildCharacterCardInput {
  project: Project;
  versionLabel?: string;
  note?: string;
  exportedAt?: string;
}

function getSection(markdown: string, section: string) {
  return parseDossierSections(markdown).find((block) => block.section === section)?.content.trim() ?? "";
}

function normalizeText(value: string, fallback = "") {
  const next = value.trim();
  return next && next !== "尚未听见" ? next : fallback;
}

function selectedGreeting(greetings: GreetingVariant[]) {
  return greetings.find((item) => item.selected) ?? greetings[0];
}

function buildWorldEntry(entry: WorldEntry, index: number) {
  const keys = entry.keywords.length > 0 ? entry.keywords : [entry.title].filter(Boolean);

  return {
    id: index,
    keys,
    secondary_keys: [],
    comment: entry.title,
    content: entry.content,
    constant: false,
    selective: keys.length > 0,
    insertion_order: 100 + index,
    enabled: entry.enabled,
    position: 1,
    use_regex: false,
    extensions: {
      position: 1,
      exclude_recursion: false,
      display_index: index,
      probability: 100,
      useProbability: true,
      depth: 4,
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

function buildCreatorNotes(input: {
  note?: string;
  versionLabel?: string;
  trialRuns: TrialRun[];
}) {
  const blocks = [
    input.note ? `导出备注：${input.note}` : "",
    input.versionLabel ? `版本：${input.versionLabel}` : "",
    input.trialRuns[0]?.resultMarkdown ? `终审摘要：\n${input.trialRuns[0].resultMarkdown}` : "",
    input.trialRuns[0]?.riskNotes.length
      ? `终审风险记录：${input.trialRuns[0].riskNotes.join("；")}`
      : "",
  ];

  return blocks.filter(Boolean).join("\n\n");
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
      updated_at: block.updatedAt,
    })),
    trial_runs: project.trialRuns,
    exported_at: exportedAt,
  };
}

export function buildCharacterCard({
  project,
  versionLabel,
  note,
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
  const greeting = selectedGreeting(project.greetingVariants);
  const firstMes = normalizeText(greeting?.content ?? getSection(markdown, "开场白"), "{{char}}终于看见了{{user}}。");
  const description = [core, appearance, background, conflict, speech].filter(Boolean).join("\n\n");
  const creatorNotes = buildCreatorNotes({ note, versionLabel, trialRuns: project.trialRuns });
  const alternateGreetings = project.greetingVariants
    .filter((item) => item.content.trim() && item.id !== greeting?.id)
    .map((item) => item.content.trim());
  const worldEntries = project.worldEntries.filter((entry) => entry.enabled);
  const card = {
    name: title,
    description,
    personality: [core, conflict, speech].filter(Boolean).join("\n\n"),
    scenario: world,
    first_mes: firstMes,
    mes_example: "",
    creatorcomment: creatorNotes,
    avatar: "none",
    talkativeness: "0.5",
    fav: false,
    tags: ["回音", "Echo"],
    spec: "chara_card_v3" as const,
    spec_version: "3.0" as const,
    create_date: new Date(exportedAt).toLocaleString("zh-CN", { hour12: false }),
    data: {
      name: title,
      description,
      personality: [core, conflict, speech].filter(Boolean).join("\n\n"),
      scenario: world,
      first_mes: firstMes,
      mes_example: "",
      creator_notes: creatorNotes,
      system_prompt:
        "你将扮演{{char}}。保持角色已有经历、欲望、边界和说话方式，不替{{user}}做决定，不描写{{user}}的内心。",
      post_history_instructions: "持续遵守角色档案中用户确认的事实，避免突然改变人格、关系或世界逻辑。",
      tags: ["回音", "Echo"],
      creator: "Echo",
      character_version: versionLabel ?? "1.0",
      alternate_greetings: alternateGreetings,
      character_book: {
        name: `${title}的WorldInfo`,
        description: "由 Echo 寻回并经用户确认的世界书条目。",
        scan_depth: 2,
        token_budget: 2048,
        recursive_scanning: true,
        extensions: {},
        entries: worldEntries.map(buildWorldEntry),
      },
      extensions: {
        talkativeness: "0.5",
        fav: false,
        world: "",
        depth_prompt: {
          prompt: "",
          depth: 4,
          role: "system" as const,
        },
        regex_scripts: [],
        echo: buildEchoExtension(project, project.dossier.blocks, exportedAt),
      },
      group_only_greetings: [],
    },
  };

  return characterCardSchema.parse(card);
}

export function formatCharacterCardJson(card: CharacterCard) {
  return JSON.stringify(card, null, 2);
}

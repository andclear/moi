import { z } from "zod";

const nullableNumberSchema = z.number().nullable();
const nullableBooleanSchema = z.boolean().nullable();
const talkativenessSchema = z.union([z.string(), z.number().min(0).max(1)]).default("0.5");
const selectiveLogicSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const worldPositionSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);
const worldRoleSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const regexPlacementSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(6),
]);
const defaultWorldEntryExtensions = {
  position: 4 as const,
  depth: 4,
  role: 0 as const,
  selectiveLogic: 0 as const,
  probability: 100,
  useProbability: true,
  scan_depth: null,
  case_sensitive: null,
  match_whole_words: null,
  exclude_recursion: false,
  prevent_recursion: false,
  delay_until_recursion: false,
  group: "",
  group_override: false,
  group_weight: 100,
  use_group_scoring: false,
  sticky: null,
  cooldown: null,
  delay: null,
  match_persona_description: false,
  match_character_description: false,
  match_character_personality: false,
  match_character_depth_prompt: false,
  match_scenario: false,
  match_creator_notes: false,
  automation_id: "",
  vectorized: false,
  triggers: [],
  ignore_budget: false,
  outlet_name: "",
};
const defaultDepthPrompt = {
  prompt: "",
  depth: 4,
  role: "system" as const,
};
const defaultCharacterExtensions = {
  talkativeness: "0.5",
  fav: false,
  world: "",
  depth_prompt: defaultDepthPrompt,
  regex_scripts: [],
};

export const regexScriptSchema = z
  .object({
    id: z.string().min(1),
    scriptName: z.string().min(1),
    findRegex: z.string(),
    replaceString: z.string(),
    trimStrings: z.array(z.string()).default([]),
    placement: z.array(regexPlacementSchema).default([1, 2]),
    disabled: z.boolean().default(false),
    markdownOnly: z.boolean().default(false),
    promptOnly: z.boolean().default(false),
    runOnEdit: z.boolean().default(true),
    substituteRegex: worldRoleSchema.default(0),
    minDepth: nullableNumberSchema.default(null),
    maxDepth: nullableNumberSchema.default(null),
  })
  .passthrough();

export const worldInfoEntrySchema = z
  .object({
    uid: z.number().optional(),
    id: z.number().optional(),
    key: z.array(z.string()).optional(),
    keys: z.array(z.string()).optional(),
    keysecondary: z.array(z.string()).optional(),
    secondary_keys: z.array(z.string()).optional(),
    comment: z.string().default(""),
    content: z.string(),
    constant: z.boolean().optional(),
    vectorized: z.boolean().optional(),
    selective: z.boolean().optional(),
    selectiveLogic: selectiveLogicSchema.optional(),
    order: z.number().optional(),
    insertion_order: z.number().optional(),
    enabled: z.boolean().optional(),
    position: z.union([worldPositionSchema, z.string()]).default(4),
    disable: z.boolean().optional(),
    use_regex: z.boolean().optional(),
    extensions: z
      .object({
        position: worldPositionSchema.default(4),
        exclude_recursion: z.boolean().default(false),
        display_index: z.number().optional(),
        probability: z.number().min(0).max(100).default(100),
        useProbability: z.boolean().default(true),
        depth: z.number().default(4),
        selectiveLogic: selectiveLogicSchema.default(0),
        outlet_name: z.string().default(""),
        group: z.string().default(""),
        group_override: z.boolean().default(false),
        group_weight: z.number().default(100),
        prevent_recursion: z.boolean().default(false),
        delay_until_recursion: z.union([z.boolean(), z.number()]).default(false),
        scan_depth: nullableNumberSchema.default(null),
        match_whole_words: nullableBooleanSchema.default(null),
        use_group_scoring: z.boolean().default(false),
        case_sensitive: nullableBooleanSchema.default(null),
        automation_id: z.string().default(""),
        role: worldRoleSchema.default(0),
        vectorized: z.boolean().default(false),
        sticky: nullableNumberSchema.default(null),
        cooldown: nullableNumberSchema.default(null),
        delay: nullableNumberSchema.default(null),
        match_persona_description: z.boolean().default(false),
        match_character_description: z.boolean().default(false),
        match_character_personality: z.boolean().default(false),
        match_character_depth_prompt: z.boolean().default(false),
        match_scenario: z.boolean().default(false),
        match_creator_notes: z.boolean().default(false),
        triggers: z
          .array(z.enum(["normal", "continue", "impersonate", "swipe", "regenerate", "quiet"]))
          .default([]),
        ignore_budget: z.boolean().default(false),
      })
      .passthrough()
      .default(defaultWorldEntryExtensions),
  })
  .passthrough()
  .refine((entry) => entry.key || entry.keys, {
    message: "世界书条目必须提供 key 或 keys。",
  });

export const characterCardSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    personality: z.string().default(""),
    scenario: z.string().default(""),
    first_mes: z.string(),
    mes_example: z.string().default(""),
    creatorcomment: z.string().default(""),
    avatar: z.string().default("none"),
    talkativeness: talkativenessSchema,
    fav: z.union([z.boolean(), z.string()]).default(false),
    tags: z.array(z.string()).default([]),
    spec: z.literal("chara_card_v3"),
    spec_version: z.literal("3.0"),
    data: z
      .object({
        name: z.string(),
        description: z.string(),
        personality: z.string().default(""),
        scenario: z.string().default(""),
        first_mes: z.string(),
        mes_example: z.string().default(""),
        creator_notes: z.string().default(""),
        system_prompt: z.string().optional(),
        post_history_instructions: z.string().optional(),
        tags: z.array(z.string()).default([]),
        creator: z.string().default(""),
        character_version: z.string().default(""),
        alternate_greetings: z.array(z.string()).default([]),
        extensions: z
          .object({
            talkativeness: talkativenessSchema,
            fav: z.boolean().default(false),
            world: z.string().default(""),
            depth_prompt: z
              .object({
                prompt: z.string().default(""),
                depth: z.number().default(4),
                role: z.enum(["system", "user", "assistant"]).default("system"),
              })
              .passthrough()
              .default(defaultDepthPrompt),
            regex_scripts: z.array(regexScriptSchema).default([]),
          })
          .passthrough()
          .default(defaultCharacterExtensions),
        group_only_greetings: z.array(z.string()).default([]),
        character_book: z
          .object({
            entries: z.array(worldInfoEntrySchema).default([]),
            name: z.string().default(""),
            description: z.string().optional(),
            scan_depth: z.number().optional(),
            token_budget: z.number().optional(),
            recursive_scanning: z.boolean().optional(),
            extensions: z.record(z.string(), z.unknown()).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
    create_date: z.string().optional(),
  })
  .passthrough();

export type CharacterCard = z.infer<typeof characterCardSchema>;

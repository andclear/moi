import { z } from "zod";

export const characterCardSchema = z.object({
  spec: z.string().default("echo_intermediate_character_card"),
  spec_version: z.string().default("0.1.0"),
  data: z.object({
    name: z.string().default("未命名的回音"),
    description: z.string().default(""),
    personality: z.string().default(""),
    scenario: z.string().default(""),
    first_mes: z.string().default(""),
    mes_example: z.string().default(""),
    creator_notes: z.string().default(""),
    tags: z.array(z.string()).default([]),
    extensions: z.record(z.string(), z.unknown()).default({}),
  }),
});

export type CharacterCard = z.infer<typeof characterCardSchema>;

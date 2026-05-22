import type { CharacterProfileDocument } from "@/db/types";

function normalizePlaceholderText(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

export function hasUsableCharacterProfile(characterProfile?: CharacterProfileDocument) {
  const yaml = characterProfile?.yaml?.trim() ?? "";
  return Boolean(yaml && normalizePlaceholderText(yaml) !== "暂未明确");
}

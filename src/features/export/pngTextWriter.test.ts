import { describe, expect, it } from "vitest";

import {
  readCharacterCardJsonFromPng,
  readPngTextChunks,
  writeCharacterCardTextChunks,
} from "@/features/export/pngTextWriter";

function tinyPngBytes() {
  return Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  );
}

describe("pngTextWriter", () => {
  it("向 PNG 同时写入 chara 与 ccv3，并可优先读取 ccv3", () => {
    const formattedJson = JSON.stringify({ spec: "chara_card_v3", data: { name: "回音" } }, null, 2);
    const output = writeCharacterCardTextChunks(tinyPngBytes(), formattedJson);
    const chunks = readPngTextChunks(output);

    expect(chunks.some((chunk) => chunk.keyword === "chara")).toBe(true);
    expect(chunks.some((chunk) => chunk.keyword === "ccv3")).toBe(true);
    expect(readCharacterCardJsonFromPng(output)).toBe(formattedJson);
  });
});

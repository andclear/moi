import { describe, expect, it } from "vitest";

import {
  buildDossierBlockMeta,
  createDefaultDossierMarkdown,
  mergeAiDossierMarkdown,
} from "@/features/dossier/dossierSections";
import { nowIso } from "@/shared/lib/date";

describe("dossierSections", () => {
  it("为默认 Markdown 建立块级元数据", () => {
    const markdown = createDefaultDossierMarkdown();
    const blocks = buildDossierBlockMeta(markdown, [], "ai_inferred", nowIso());

    expect(blocks.map((block) => block.section)).toContain("核心人格");
    expect(blocks[0]?.source).toBe("ai_inferred");
    expect(blocks[0]?.locked).toBe(false);
  });

  it("用户修改后标记为用户确认事实", () => {
    const initial = createDefaultDossierMarkdown();
    const initialBlocks = buildDossierBlockMeta(initial, [], "ai_inferred", nowIso());
    const edited = initial.replace("尚未听见", "TA 把沉默当作最后的礼貌。");
    const editedBlocks = buildDossierBlockMeta(edited, initialBlocks, "user_confirmed", nowIso());

    expect(editedBlocks.find((block) => block.section === "核心人格")?.source).toBe(
      "user_confirmed",
    );
  });

  it("合并 AI 记录时保留原有段落顺序并使用新内容", () => {
    const initial = "## 核心人格\n\n用户确认的本心\n\n## 世界观\n\n旧世界";
    const ai = "## 核心人格\n\nAI 想改写的本心\n\n## 世界观\n\n新世界";
    const merged = mergeAiDossierMarkdown(initial, ai);

    expect(merged.markdown).toContain("AI 想改写的本心");
    expect(merged.markdown).toContain("新世界");
  });
});

import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import {
  adoptGreetingVariant,
  createGreetingCandidates,
  parseGreetingResponseText,
  pruneUnadoptedGreetingVariants,
  removeCotBlocksFromGreeting,
  setGreetingSortOrder,
} from "@/features/greeting/greetingStore";

describe("greetingStore", () => {
  it("采用开场白后设置主开场白并同步记录", () => {
    const project = createProjectDraft({ id: "project_greeting" });
    const [first, second] = createGreetingCandidates("project_greeting", [
      { content: "{{char}} 递来一封湿透的信。" },
      { content: "{{user}} 看见 {{char}} 站在末班车前。" },
    ]);

    const selected = adoptGreetingVariant(
      { ...project, greetingVariants: [first, second] },
      second.id,
    );

    expect(selected.greetingVariants.find((variant) => variant.id === second.id)).toMatchObject({
      adopted: true,
      selected: false,
      sortOrder: 1,
    });
    expect(selected.greetingVariants.filter((variant) => variant.selected)).toHaveLength(0);
    expect(selected.dossier.markdown).toContain("{{user}} 看见 {{char}}");
  });

  it("重新排序后排序第一的开场白成为主开场白", () => {
    const project = createProjectDraft({ id: "project_order" });
    const [first, second] = createGreetingCandidates("project_order", [
      { content: "第一条。" },
      { content: "第二条。" },
    ]);
    const withFirst = adoptGreetingVariant({ ...project, greetingVariants: [first, second] }, first.id);
    const withSecond = adoptGreetingVariant(withFirst, second.id);
    const reordered = setGreetingSortOrder(withSecond, second.id, 1);

    expect(reordered.greetingVariants.find((variant) => variant.id === second.id)).toMatchObject({
      selected: false,
      sortOrder: 1,
    });
    expect(reordered.dossier.markdown).toContain("第二条。");
  });

  it("再次生成前会清理未采用候选并保留已采用开场白", () => {
    const project = createProjectDraft({ id: "project_prune" });
    const [first, second] = createGreetingCandidates("project_prune", [
      { content: "保留。" },
      { content: "删除。" },
    ]);
    const adopted = adoptGreetingVariant({ ...project, greetingVariants: [first, second] }, first.id);
    const pruned = pruneUnadoptedGreetingVariants(adopted);

    expect(pruned.greetingVariants).toHaveLength(1);
    expect(pruned.greetingVariants[0]?.content).toBe("保留。");
  });

  it("移除模型输出中的思维链内容", () => {
    expect(removeCotBlocksFromGreeting("<cot>检查内容</cot>\n{{char}} 看见 {{user}}。")).toBe(
      "{{char}} 看见 {{user}}。",
    );
  });

  it("从纯文本响应中解析多个开场白", () => {
    const parsed = parseGreetingResponseText(
      `<cot>检查</cot>\n第一条正文。\n\n---GREETING---\n\n第二条正文。`,
    );

    expect(parsed).toEqual([{ content: "第一条正文。" }, { content: "第二条正文。" }]);
  });
});

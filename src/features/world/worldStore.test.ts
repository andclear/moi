import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import { buildWorldEntryMessages, extractCurrentWorldInfo } from "@/prompts/worldPrompts";
import { worldEntryResponseSchema } from "@/schemas/llmResponseSchemas";
import {
  confirmWorldEntry,
  createWorldEntryCandidates,
  formatWorldInfoForDossier,
} from "@/features/world/worldStore";

describe("worldStore", () => {
  it("只把已确认 WorldInfo 写入记录上下文", () => {
    const project = createProjectDraft({ id: "project_world" });
    const [candidate] = createWorldEntryCandidates("project_world", [
      {
        comment: "旧码头钟楼",
        content: "【感官入口】：铜钟边缘已经发绿。",
        keywords: ["钟楼"],
      },
    ]);

    const withCandidate = { ...project, worldEntries: [candidate] };
    expect(formatWorldInfoForDossier(withCandidate.worldEntries)).toContain("尚未听见");

    const confirmed = confirmWorldEntry(withCandidate, candidate.id);
    expect(confirmed.worldEntries[0].enabled).toBe(true);
    expect(confirmed.dossier.markdown).toContain("WorldInfo:");
    expect(confirmed.dossier.markdown).toContain("旧码头钟楼");
  });

  it("保存世界书生成字段，并兼容字符串形式的模型输出", () => {
    const [parsed] = worldEntryResponseSchema.parse([
      {
        comment: "东翼第三进院",
        content: "【空间逻辑】：院墙有三丈高。",
        constant: "false",
        keys: "[东翼,第三进院]",
        position: "4",
        depth: "4",
        insertion_order: "106",
      },
    ]);

    const [candidate] = createWorldEntryCandidates("project_world", [parsed]);

    expect(candidate.keys).toEqual(["东翼", "第三进院"]);
    expect(candidate.keywords).toEqual(["东翼", "第三进院"]);
    expect(candidate.constant).toBe(false);
    expect(candidate.position).toBe(4);
    expect(candidate.depth).toBe(4);
    expect(candidate.insertionOrder).toBe(106);
  });

  it("从登岛问卷答案中提取当前世界信息", () => {
    const project = createProjectDraft({ id: "project_world" });
    project.intake = {
      brief: "想找一个旧城区里的人。",
      gender: "女",
      questionnaire: {
        title: "登岛小问卷",
        designNote: "",
        questions: [
          {
            id: "q_world",
            title: "TA 所处的世界观是什么？",
            options: [
              { id: "modern", label: "现代都市" },
              { id: "custom", label: "其他", allowCustom: true },
            ],
          },
        ],
      },
      answers: [{ questionId: "q_world", optionId: "custom", customValue: "近未来海港城" }],
    };

    expect(extractCurrentWorldInfo(project)).toBe("近未来海港城");
    expect(extractCurrentWorldInfo(createProjectDraft())).toBe("尚未明确");
  });

  it("世界书提示词上下文包含角色档案和角色信息", () => {
    const messages = buildWorldEntryMessages({
      dossierMarkdown: "## 核心人格\n\n谨慎，怕被遗忘。",
      characterInfo: "姓名: 陈露\n基本信息:\n  年龄: 22",
      currentWorldInfo: "现代都市",
      existingWorldEntries: [],
      userRequest: "生成居住区域",
      entryCount: 1,
    });

    expect(messages[0].content).toContain("角色档案");
    expect(messages[0].content).toContain("角色信息");
    expect(messages[0].content).toContain("不要用几句概括带过");
    expect(messages[0].content).toContain("运转代价");
    expect(messages[0].content).toContain("不设置最大长度");
    expect(messages[0].content).toContain("entry_count 是本次生成数量上限");
    expect(messages[0].content).toContain("不要输出 keywords 字段");
    expect(messages[0].content).toContain("不要让每个条目都机械套用同一批标题");
    expect(messages[1].content).toContain("姓名: 陈露");
    expect(messages[1].content).toContain("## 核心人格");
  });
});

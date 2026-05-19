import { describe, expect, it } from "vitest";

import { createProjectDraft } from "@/db/defaults";
import {
  buildWorldAssociationRequest,
  buildWorldDeepenRequest,
  buildWorldEntryMessages,
  extractCurrentWorldInfo,
  formatWorldEntriesJson,
} from "@/prompts/worldPrompts";
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
        keys: ["钟楼"],
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
    expect(candidate.constant).toBe(false);
    expect(candidate.position).toBe(4);
    expect(candidate.depth).toBe(4);
    expect(candidate.insertionOrder).toBe(106);
  });

  it("常驻世界书条目不保存触发关键词", () => {
    const [candidate] = createWorldEntryCandidates("project_world", [
      {
        comment: "潮汐铁律",
        content: "退潮时所有桥洞都会露出旧编号。",
        constant: true,
        keys: ["潮汐", "桥洞"],
      },
    ]);

    expect(candidate.constant).toBe(true);
    expect(candidate.keys).toEqual([]);
    expect(formatWorldEntriesJson([candidate])).toContain('"keys": []');
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
    expect(messages[0].content).toContain("用户信息 character_info");
    expect(messages[0].content).toContain("真实姓名");
    expect(messages[0].content).toContain("严格等于 entry_count");
    expect(messages[0].content).toContain("constant/keys 判断规则");
    expect(messages[0].content).toContain("keys 必须输出空数组");
    expect(messages[0].content).toContain("不要用几句概括带过");
    expect(messages[0].content).toContain("运转代价");
    expect(messages[0].content).toContain("不设置最大长度");
    expect(messages[0].content).toContain("entry_count 是必须输出的条目数量");
    expect(messages[0].content).toContain("独立需求单元");
    expect(messages[0].content).toContain("即使用户没有编号");
    expect(messages[0].content).toContain("亲密度阶段变化");
    expect(messages[0].content).toContain("禁止把“低/中/高”");
    expect(messages[0].content).toContain("社会默认规则");
    expect(messages[0].content).toContain("优先判断为 constant=true");
    expect(messages[0].content).toContain("每个条目只能包含");
    expect(messages[0].content).toContain("只允许使用 keys 字段");
    expect(messages[0].content).toContain("不要让每个条目都机械套用同一批标题");
    expect(messages[0].content).not.toContain("enabled");
    expect(messages[1].content).toContain("character_info");
    expect(messages[1].content).toContain("姓名: 陈露");
    expect(messages[1].content).toContain("## 核心人格");
  });

  it("深挖和联想提示词分别要求替换原条目与生成新条目", () => {
    const [entry] = createWorldEntryCandidates("project_world", [
      {
        comment: "雨港信号灯",
        content: "【旧规矩还在运转】：信号灯每晚闪三次。",
        keys: ["雨港", "信号灯"],
      },
    ]);

    const deepenRequest = buildWorldDeepenRequest(entry);
    const associationRequest = buildWorldAssociationRequest(entry);

    expect(deepenRequest).toContain("替换当前世界书条目");
    expect(deepenRequest).toContain("质量还不够好");
    expect(deepenRequest).toContain("只生成 1 条，用于替换");
    expect(deepenRequest).toContain("语言必须简单、直接、精确");
    expect(associationRequest).toContain("生成一个新的补充条目");
    expect(associationRequest).toContain("不能复述或改写当前条目");
    expect(associationRequest).toContain("不要追求文学性");
    expect(associationRequest).toContain("不要替换 current_entry_json");
  });
});

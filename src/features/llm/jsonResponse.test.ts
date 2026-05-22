import { describe, expect, it } from "vitest";
import { z } from "zod";

import { extractJsonValue, parseLlmJson } from "@/features/llm/jsonResponse";
import {
  intakeQuestionnaireResponseSchema,
  profileDiaryResponseSchema,
  trialAnswerSetResponseSchema,
  trialQuestionnaireSetResponseSchema,
  trialRevisionResponseSchema,
} from "@/schemas/llmResponseSchemas";

describe("jsonResponse", () => {
  it("可以直接解析 JSON 数组", () => {
    expect(extractJsonValue('[{"comment":"旧桥","content":"【痕迹】：桥面开裂。"}]')).toEqual([
      { comment: "旧桥", content: "【痕迹】：桥面开裂。" },
    ]);
  });

  it("可以从模型前后说明中提取 JSON 数组", () => {
    const schema = z.array(z.object({ comment: z.string(), content: z.string() }));

    expect(
      parseLlmJson(
        '以下是结果：\n[{"comment":"旧桥","content":"【痕迹】：桥面开裂，栏杆有锈。"}]\n请查收。',
        schema,
      ),
    ).toHaveLength(1);
  });

  it("可以解析 fenced JSON", () => {
    expect(extractJsonValue('```json\n{"title":"来岛上"}\n```')).toEqual({ title: "来岛上" });
  });

  it("可以从多个代码块中选择 JSON，并修正常见尾逗号", () => {
    expect(
      extractJsonValue(
        [
          "说明如下：",
          "```text",
          "不是结构化结果",
          "```",
          "```json",
          '{"title":"来岛上","questions":[{"title":"方向","options":["A",],},],}',
          "```",
        ].join("\n"),
      ),
    ).toEqual({
      title: "来岛上",
      questions: [{ title: "方向", options: ["A"] }],
    });
  });

  it("登岛问卷解析不会因为模型多给选项直接失败", () => {
    const content = JSON.stringify({
      title: "设定补充",
      questions: Array.from({ length: 5 }, (_, index) => ({
        title: `问题 ${index + 1}`,
        options: Array.from({ length: 7 }, (_option, optionIndex) => ({
          label: optionIndex === 6 ? "其他" : `选项 ${optionIndex + 1}`,
          allowCustom: optionIndex === 6,
        })),
      })),
    });

    expect(
      parseLlmJson(content, intakeQuestionnaireResponseSchema).questions[0].options,
    ).toHaveLength(7);
  });

  it("可以解析三模式终审问卷", () => {
    const content = JSON.stringify({
      modes: {
        interview: { title: "三席岛访", questions: [{ id: "interview_1", question: "问题" }] },
        stress: { title: "风浪压测", questions: [{ id: "stress_1", question: "问题" }] },
        diary: { title: "日记回音", questions: [{ id: "diary_1", question: "问题" }] },
      },
    });

    expect(parseLlmJson(content, trialQuestionnaireSetResponseSchema).modes.diary.title).toBe(
      "日记回音",
    );
  });

  it("可以解析三模式终审回答和不满意修改建议", () => {
    const answerContent = JSON.stringify({
      modes: {
        interview: {
          title: "三席岛访",
          answers: [
            {
              questionId: "interview_1",
              formalReply: "正式回复",
              innerMonologue: "内心独白",
              riskSentences: [],
            },
          ],
          riskNotes: [],
        },
        stress: {
          title: "风浪压测",
          answers: [
            {
              questionId: "stress_1",
              formalReply: "正式回复",
              innerMonologue: "内心独白",
              riskSentences: ["风险句"],
            },
          ],
          riskNotes: ["风险说明"],
        },
        diary: {
          title: "日记来信",
          answers: [
            {
              questionId: "diary_1",
              formalReply: "正式回复",
              innerMonologue: "内心独白",
              riskSentences: [],
            },
          ],
          riskNotes: [],
        },
      },
    });
    const revisionContent = JSON.stringify({
      summary: "修改角色档案",
      changes: [
        {
          source: "dossier",
          title: "说话风格",
          before: "原文",
          after: "新文本",
          reason: "更符合反馈",
        },
      ],
    });

    expect(
      parseLlmJson(answerContent, trialAnswerSetResponseSchema).modes.stress.riskNotes,
    ).toContain("风险说明");
    expect(parseLlmJson(revisionContent, trialRevisionResponseSchema).changes[0].before).toBe(
      "原文",
    );
  });

  it("不满意修改建议会过滤 targetId 无效的修改项", () => {
    const content = JSON.stringify({
      summary: "保留可应用的修改",
      changes: [
        {
          source: "worldinfo",
          targetId: null,
          title: "缺少目标",
          before: "原文",
          after: "新文本",
          reason: "没有目标 ID，不能应用",
        },
        {
          source: "greeting",
          targetId: "greeting_1",
          title: "开场白",
          before: "旧开场",
          after: "新开场",
          reason: "更符合反馈",
        },
        {
          source: "dossier",
          targetId: null,
          title: "核心人格",
          before: "旧人格",
          after: "新人格",
          reason: "档案不需要 targetId",
        },
      ],
    });

    const parsed = parseLlmJson(content, trialRevisionResponseSchema);

    expect(parsed.changes).toHaveLength(2);
    expect(parsed.changes[0].source).toBe("greeting");
    expect(parsed.changes[1].targetId).toBeUndefined();
  });

  it("日记响应可以容忍可选字段为 null 并清理坏选项", () => {
    const content = JSON.stringify({
      title: "旧日记",
      diaryText: "[[blank_1]]，[[blank_2]]，[[blank_3]]。",
      note: null,
      blanks: [
        {
          key: "blank_1",
          label: "第一处",
          options: [
            { label: "选项 1", meaning: "含义 1" },
            { label: "选项 2", meaning: "含义 2" },
            { label: "选项 3", meaning: "含义 3" },
          ],
        },
        {
          key: null,
          label: "第二处",
          options: [
            { label: "选项 1", meaning: "含义 1" },
            { label: "选项 2", meaning: "含义 2" },
            { label: "选项 3", meaning: "含义 3" },
          ],
        },
        {
          key: "blank_3",
          label: "第三处",
          options: [
            { label: "选项 1", meaning: "含义 1" },
            { label: "选项 2", meaning: "含义 2" },
            { label: "选项 3", meaning: "含义 3" },
          ],
        },
      ],
    });

    const parsed = parseLlmJson(content, profileDiaryResponseSchema);

    expect(parsed.note).toBeUndefined();
    expect(parsed.blanks[1].key).toBeUndefined();
  });
});

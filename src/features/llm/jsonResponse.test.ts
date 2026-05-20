import { describe, expect, it } from "vitest";
import { z } from "zod";

import { extractJsonValue, parseLlmJson } from "@/features/llm/jsonResponse";
import {
  intakeQuestionnaireResponseSchema,
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
    expect(extractJsonValue('```json\n{"title":"回音"}\n```')).toEqual({ title: "回音" });
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
        diary: { title: "日记回声", questions: [{ id: "diary_1", question: "问题" }] },
      },
    });

    expect(parseLlmJson(content, trialQuestionnaireSetResponseSchema).modes.diary.title).toBe(
      "日记回声",
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
          title: "日记回声",
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
});

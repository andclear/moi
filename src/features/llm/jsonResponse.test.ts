import { describe, expect, it } from "vitest";
import { z } from "zod";

import { extractJsonValue, parseLlmJson } from "@/features/llm/jsonResponse";
import { intakeQuestionnaireResponseSchema } from "@/schemas/llmResponseSchemas";

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

    expect(parseLlmJson(content, intakeQuestionnaireResponseSchema).questions[0].options).toHaveLength(7);
  });
});

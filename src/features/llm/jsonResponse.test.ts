import { describe, expect, it } from "vitest";
import { z } from "zod";

import { extractJsonValue, parseLlmJson } from "@/features/llm/jsonResponse";

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
});

import { describe, expect, it } from "vitest";

import { readTextResponse } from "@/features/llm/streamParser";

describe("streamParser", () => {
  it("可以按 CRLF 分隔的 SSE 事件增量输出", async () => {
    const response = new Response(
      [
        'data: {"choices":[{"delta":{"content":"<cot>先看线索"}}]}\r\n\r\n',
        'data: {"choices":[{"delta":{"content":"，再设计题目</cot>"}}]}\r\n\r\n',
        "data: [DONE]\r\n\r\n",
      ].join(""),
      {
        headers: {
          "content-type": "text/event-stream",
        },
      },
    );
    const deltas: string[] = [];

    const content = await readTextResponse(response, (delta) => deltas.push(delta));

    expect(deltas).toEqual(["<cot>先看线索", "，再设计题目</cot>"]);
    expect(content).toBe("<cot>先看线索，再设计题目</cot>");
  });

  it("会忽略 DeepSeek 推理增量，只把正文内容流式输出", async () => {
    const response = new Response(
      [
        'data: {"choices":[{"delta":{"reasoning_content":"这里是思考过程"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"，我在。"}}]}\n\n',
        "data: [DONE]\n\n",
      ].join(""),
      {
        headers: {
          "content-type": "text/event-stream",
        },
      },
    );
    const deltas: string[] = [];

    const content = await readTextResponse(response, (delta) => deltas.push(delta));

    expect(deltas).toEqual(["你好", "，我在。"]);
    expect(content).toBe("你好，我在。");
  });
});

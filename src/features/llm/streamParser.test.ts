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
});

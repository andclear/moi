import { afterEach, describe, expect, it, vi } from "vitest";

import handler from "./custom-llm";

function createNodeRequest(body: unknown) {
  const request = (async function* () {
    yield JSON.stringify(body);
  })();

  return Object.assign(request, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("custom-llm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Node 响应模式下会透传流式 SSE，而不是按 JSON 解析", async () => {
    const sseText = [
      'data: {"choices":[{"delta":{"content":"你好"}}]}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    const fetchMock = vi.fn(async () => {
      return new Response(sseText, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = {
      status: vi.fn(function status() {
        return response;
      }),
      setHeader: vi.fn(),
      write: vi.fn(),
      json: vi.fn(),
      end: vi.fn(),
    };

    await handler(
      createNodeRequest({
        apiBaseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        temperature: 0.7,
        supportsSystemPrompt: true,
        stream: true,
        messages: [{ role: "user", content: "打个招呼" }],
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
    expect(response.json).not.toHaveBeenCalled();
    expect(new TextDecoder().decode(response.write.mock.calls[0][0])).toBe(sseText);
    expect(response.end).toHaveBeenCalledWith();
  });

  it("上游不支持流式输出时会自动降级为非流式请求", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("stream is not supported by this model", {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { content: "你好，我在。" } }],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = {
      status: vi.fn(function status() {
        return response;
      }),
      setHeader: vi.fn(),
      json: vi.fn(),
      end: vi.fn(),
    };

    await handler(
      createNodeRequest({
        apiBaseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        temperature: 0.7,
        supportsSystemPrompt: true,
        stream: true,
        messages: [{ role: "user", content: "打个招呼" }],
      }),
      response,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ stream: true });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("stream");
    expect(response.json).toHaveBeenCalledWith({
      choices: [{ message: { content: "你好，我在。" } }],
    });
  });

  it("非流式兼容问题的上游错误不会触发降级重试", async () => {
    const fetchMock = vi.fn(async () => {
      return Response.json({ error: "invalid api key" }, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = {
      status: vi.fn(function status() {
        return response;
      }),
      setHeader: vi.fn(),
      json: vi.fn(),
      end: vi.fn(),
    };

    await handler(
      createNodeRequest({
        apiBaseUrl: "https://example.com/v1",
        apiKey: "bad-key",
        model: "test-model",
        temperature: 0.7,
        supportsSystemPrompt: true,
        stream: true,
        messages: [{ role: "user", content: "打个招呼" }],
      }),
      response,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: '{"error":"invalid api key"}' });
  });
});

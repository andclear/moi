import { afterEach, describe, expect, it, vi } from "vitest";

import handler, {
  normalizeCustomLlmBaseUrl,
  normalizeCustomModelList,
} from "../../../api/custom-llm/models";

describe("custom model list api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("会标准化常见 OpenAI 模型列表响应", () => {
    expect(
      normalizeCustomModelList({
        data: [
          { id: "gpt-4.1-mini", owned_by: "openai" },
          { id: "deepseek-chat" },
          { owned_by: "missing-id" },
        ],
      }),
    ).toEqual([
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini · openai" },
      { id: "deepseek-chat", label: "deepseek-chat" },
    ]);
  });

  it("会把误填的 chat completions 地址还原到 base url", () => {
    expect(normalizeCustomLlmBaseUrl("https://api.example.com/v1/chat/completions")).toBe(
      "https://api.example.com/v1",
    );
  });

  it("请求模型列表时使用标准化 URL 和 Authorization", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "test-model", owned_by: "vendor" }] })),
    );

    const response = (await handler(
      new Request("http://localhost/api/custom-llm/models", {
        method: "POST",
        body: JSON.stringify({
          apiBaseUrl: "https://api.example.com/v1/chat/completions",
          apiKey: "sk-test",
        }),
      }),
    )) as Response;

    expect(fetchSpy).toHaveBeenCalledWith("https://api.example.com/v1/models", {
      method: "GET",
      headers: { Authorization: "Bearer sk-test" },
    });
    await expect(response.json()).resolves.toEqual({
      models: [{ id: "test-model", label: "test-model · vendor" }],
    });
  });

  it("上游失败时返回错误", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad key", { status: 401 }));

    const response = (await handler(
      new Request("http://localhost/api/custom-llm/models", {
        method: "POST",
        body: JSON.stringify({
          apiBaseUrl: "https://api.example.com/v1",
          apiKey: "bad",
        }),
      }),
    )) as Response;

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "bad key" });
  });
});

import {
  getRequestMethod,
  readJsonBody,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../src/server/runtime/http.js";

interface ModelListPayload {
  apiBaseUrl?: unknown;
  apiKey?: unknown;
}

interface UpstreamModel {
  id?: unknown;
  owned_by?: unknown;
}

export function normalizeCustomLlmBaseUrl(url: string) {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "");
}

export function normalizeCustomModelList(payload: unknown) {
  const data =
    payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data as UpstreamModel[])
      : [];

  return data
    .map((model) => {
      const id = typeof model.id === "string" ? model.id.trim() : "";
      if (!id) {
        return null;
      }

      const owner = typeof model.owned_by === "string" ? model.owned_by.trim() : "";
      return {
        id,
        label: owner ? `${id} · ${owner}` : id,
      };
    })
    .filter((model): model is { id: string; label: string } => Boolean(model));
}

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (getRequestMethod(request) !== "POST") {
    return sendJson({ error: "仅支持 POST 请求。" }, { status: 405 }, response);
  }

  try {
    const payload = await readJsonBody<ModelListPayload>(request, {});
    const apiBaseUrl = typeof payload.apiBaseUrl === "string" ? payload.apiBaseUrl.trim() : "";
    const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
    if (!apiBaseUrl || !apiKey) {
      return sendJson({ error: "请先填写 API Base URL 和 API Key。" }, { status: 400 }, response);
    }

    const upstream = await fetch(`${normalizeCustomLlmBaseUrl(apiBaseUrl)}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!upstream.ok) {
      return sendJson(
        { error: (await upstream.text().catch(() => "")) || "模型列表获取失败。" },
        { status: upstream.status },
        response,
      );
    }

    const models = normalizeCustomModelList(await upstream.json());
    return sendJson({ models }, undefined, response);
  } catch (error) {
    return sendJson(
      {
        error:
          error instanceof Error
            ? `模型列表获取失败：${error.message}`
            : "模型列表获取失败。",
      },
      { status: 500 },
      response,
    );
  }
}

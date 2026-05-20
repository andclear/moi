type HeaderMap = Record<string, string | string[] | undefined>;

type NodeLikeRequest = AsyncIterable<Buffer | string> & {
  method?: string;
  headers?: HeaderMap;
};

type NodeLikeResponse = {
  status?: (statusCode: number) => NodeLikeResponse;
  setHeader?: (name: string, value: string) => void;
  json?: (body: unknown) => void;
  end?: (body?: string) => void;
};

export type ApiRequest = Request | NodeLikeRequest;
export type ApiResponse = NodeLikeResponse | undefined;

export function getRequestMethod(request: ApiRequest) {
  return request.method ?? "GET";
}

export function getRequestHeader(request: ApiRequest, name: string) {
  const headers = request.headers;
  if (!headers) {
    return "";
  }

  if ("get" in headers && typeof headers.get === "function") {
    return headers.get(name) ?? "";
  }

  const value = (headers as HeaderMap)[name.toLowerCase()] ?? (headers as HeaderMap)[name];
  return Array.isArray(value) ? value.join(", ") : (value ?? "");
}

export function getRequestUrl(request: ApiRequest) {
  if ("url" in request && typeof request.url === "string") {
    return request.url;
  }
  return "/";
}

export async function readJsonBody<T>(request: ApiRequest, fallback: T): Promise<T> {
  if ("json" in request && typeof request.json === "function") {
    return (await request.json().catch(() => fallback)) as T;
  }

  let body = "";
  for await (const chunk of request as NodeLikeRequest) {
    body += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  }

  if (!body.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return fallback;
  }
}

export function sendJson(body: unknown, init?: { status?: number }, response?: ApiResponse) {
  const status = init?.status ?? 200;
  if (response) {
    response.status?.(status);
    response.setHeader?.("Content-Type", "application/json; charset=utf-8");
    if (response.json) {
      response.json(body);
      return;
    }
    response.end?.(JSON.stringify(body));
    return;
  }

  return Response.json(body, { status });
}

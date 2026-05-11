import { activateCode } from "../src/server/activation/activationSessions";

export const config = {
  maxDuration: 10,
};

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return Response.json({ error: "仅支持 POST 请求。" }, { status: 405 });
  }

  try {
    const payload = (await request.json()) as { code?: string };
    if (!payload.code?.trim()) {
      return Response.json({ error: "请输入激活码。" }, { status: 400 });
    }

    return Response.json(await activateCode(payload.code));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "激活失败。" },
      { status: 400 },
    );
  }
}

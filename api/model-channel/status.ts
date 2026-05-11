import { getPublicModelChannelStatus } from "../../src/server/admin/modelChannel";

export const config = {
  maxDuration: 10,
};

export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return Response.json({ error: "仅支持 GET 请求。" }, { status: 405 });
  }

  try {
    return Response.json(await getPublicModelChannelStatus());
  } catch {
    return Response.json({ presetEnabled: false });
  }
}

import { getPublicModelChannelStatus } from "../../src/server/admin/modelChannel";
import {
  getRequestMethod,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../src/server/runtime/http";

export const config = {
  maxDuration: 10,
};

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (getRequestMethod(request) !== "GET") {
    return sendJson({ error: "仅支持 GET 请求。" }, { status: 405 }, response);
  }

  try {
    return sendJson(await getPublicModelChannelStatus(), undefined, response);
  } catch {
    return sendJson({ presetEnabled: false }, undefined, response);
  }
}

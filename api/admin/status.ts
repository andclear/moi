import { isAdminRequest } from "../../src/server/admin/adminAuth.js";
import { sendJson, type ApiRequest, type ApiResponse } from "../../src/server/runtime/http.js";

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  return sendJson({ authenticated: isAdminRequest(request) }, undefined, response);
}

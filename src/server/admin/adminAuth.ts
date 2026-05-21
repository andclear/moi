import { createId } from "../../shared/lib/ids.js";
import { getRequestHeader, type ApiRequest } from "../runtime/http.js";
import { getEnv } from "../runtime/env.js";

export async function hashAdminSecret(secret: string) {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAdminPassword(password: string) {
  const expectedHash = getEnv("ADMIN_PASSWORD_HASH");
  if (!expectedHash) {
    throw new Error("后台尚未配置 ADMIN_PASSWORD_HASH。");
  }

  return (await hashAdminSecret(password)) === expectedHash;
}

export async function createAdminSessionToken() {
  const token = getEnv("ADMIN_SESSION_TOKEN") ?? createId("admin_session");
  const hash = await hashAdminSecret(token);
  return { token, hash };
}

export function isAdminRequest(request: ApiRequest) {
  const expected = getEnv("ADMIN_SESSION_TOKEN");
  if (!expected) {
    return false;
  }

  const header = getRequestHeader(request, "authorization");
  return header === `Bearer ${expected}`;
}

import { isAdminRequest } from "../../src/server/admin/adminAuth.js";
import {
  createActivationCodeBatch,
  deleteActivationCode,
  listActivationCodes,
} from "../../src/server/activation/activationCodes.js";
import { writeAdminAuditLog } from "../../src/server/admin/adminAudit.js";
import {
  getRequestMethod,
  getRequestUrl,
  readJsonBody,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../src/server/runtime/http.js";

function createPlainActivationCode() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `LPB-${suffix}`;
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function normalizeLimitedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function normalizeStatusFilter(value: string | null) {
  return value === "unused" || value === "used" ? value : "all";
}

export default async function handler(request: ApiRequest, response?: ApiResponse) {
  if (!isAdminRequest(request)) {
    return sendJson({ error: "未登录后台。" }, { status: 401 }, response);
  }

  if (getRequestMethod(request) === "GET") {
    const url = new URL(getRequestUrl(request), "https://local.invalid");
    const page = normalizePositiveInteger(url.searchParams.get("page"), 1, 100000);
    const pageSize = normalizePositiveInteger(url.searchParams.get("pageSize"), 30, 30);
    const status = normalizeStatusFilter(url.searchParams.get("status"));
    const result = await listActivationCodes({ page, pageSize, status });
    return sendJson(
      {
        codes: result.rows,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        status: result.status,
      },
      undefined,
      response,
    );
  }

  if (getRequestMethod(request) === "POST") {
    try {
      const payload = await readJsonBody<{
        usageLimit?: number;
        quantity?: number;
        durationHours?: number;
        customCodes?: string[];
      }>(request, {});
      const customCodes =
        payload.customCodes
          ?.map((code) => code.trim())
          .filter((code, index, list) => code && list.indexOf(code) === index) ?? [];
      const quantity = normalizePositiveInteger(payload.quantity, 1, 200);
      const usageLimit = normalizeLimitedInteger(payload.usageLimit, 100, 100000);
      const durationHours = normalizeLimitedInteger(payload.durationHours, 72, 24 * 365);
      const codes =
        customCodes.length > 0
          ? customCodes
          : Array.from({ length: quantity }, createPlainActivationCode);
      const records = await createActivationCodeBatch({
        codes,
        usageLimit,
        durationHours,
      });
      await writeAdminAuditLog({
        actor: "admin",
        action: "activation_code.batch_create",
        metadata: {
          quantity: codes.length,
          durationHours,
          usageLimit,
          ids: records.map((record) => record.id),
        },
      }).catch(() => undefined);
      return sendJson(
        {
          codes: records.map((record, index) => ({ ...record, code: codes[index] })),
          durationHours,
          usageLimit,
        },
        undefined,
        response,
      );
    } catch (error) {
      return sendJson(
        { error: error instanceof Error ? error.message : "生成激活码失败。" },
        { status: 400 },
        response,
      );
    }
  }

  if (getRequestMethod(request) === "DELETE") {
    const payload = await readJsonBody<{ id?: string }>(request, {});
    if (!payload.id) {
      return sendJson({ error: "缺少激活码 ID。" }, { status: 400 }, response);
    }
    await deleteActivationCode(payload.id);
    await writeAdminAuditLog({
      actor: "admin",
      action: "activation_code.delete",
      metadata: { id: payload.id },
    }).catch(() => undefined);
    return sendJson({ ok: true }, undefined, response);
  }

  return sendJson({ error: "不支持的请求方法。" }, { status: 405 }, response);
}

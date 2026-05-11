import { isAdminRequest } from "../../src/server/admin/adminAuth";
import {
  createActivationCodeBatch,
  deleteActivationCode,
  listActivationCodes,
} from "../../src/server/activation/activationCodes";
import { writeAdminAuditLog } from "../../src/server/admin/adminAudit";

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

export default async function handler(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "未登录后台。" }, { status: 401 });
  }

  if (request.method === "GET") {
    return Response.json({ codes: await listActivationCodes() });
  }

  if (request.method === "POST") {
    try {
      const payload = (await request.json().catch(() => ({}))) as {
        usageLimit?: number;
        quantity?: number;
        durationHours?: number;
        customCodes?: string[];
      };
      const customCodes =
        payload.customCodes
          ?.map((code) => code.trim())
          .filter((code, index, list) => code && list.indexOf(code) === index) ?? [];
      const quantity = normalizePositiveInteger(payload.quantity, 1, 200);
      const usageLimit = normalizePositiveInteger(payload.usageLimit, 100, 100000);
      const durationHours = normalizePositiveInteger(payload.durationHours, 72, 24 * 365);
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
      return Response.json({
        codes: records.map((record, index) => ({ ...record, code: codes[index] })),
        durationHours,
        usageLimit,
      });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "生成激活码失败。" },
        { status: 400 },
      );
    }
  }

  if (request.method === "DELETE") {
    const payload = (await request.json().catch(() => ({}))) as { id?: string };
    if (!payload.id) {
      return Response.json({ error: "缺少激活码 ID。" }, { status: 400 });
    }
    await deleteActivationCode(payload.id);
    await writeAdminAuditLog({
      actor: "admin",
      action: "activation_code.delete",
      metadata: { id: payload.id },
    }).catch(() => undefined);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "不支持的请求方法。" }, { status: 405 });
}

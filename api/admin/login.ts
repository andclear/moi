import { createAdminSessionToken, verifyAdminPassword } from "../../src/server/admin/adminAuth";
import { writeAdminAuditLog } from "../../src/server/admin/adminAudit";

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return Response.json({ error: "仅支持 POST 请求。" }, { status: 405 });
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as { password?: string };
    if (!payload.password || !(await verifyAdminPassword(payload.password))) {
      return Response.json({ error: "后台密码不正确。" }, { status: 401 });
    }

    const session = await createAdminSessionToken();
    await writeAdminAuditLog({ actor: "admin", action: "admin.login" }).catch(() => undefined);

    return Response.json({
      token: session.token,
      sessionHash: session.hash,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "后台登录失败。" },
      { status: 500 },
    );
  }
}

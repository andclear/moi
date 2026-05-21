import { createId } from "../../shared/lib/ids.js";
import { getModelChannelSettings } from "../admin/modelChannel.js";
import { createPostgresClient } from "../db/postgres.js";
import { getEnv } from "../runtime/env.js";
import { hashSessionSecret } from "./activationCodes.js";

export async function activateCode(code: string, sql = createPostgresClient()) {
  const channel = await getModelChannelSettings(sql);
  if (!channel.presetEnabled) {
    throw new Error("预置模型渠道暂未开启。");
  }

  const activationCode = code.trim();
  const sessionToken = createId("session");
  const sessionHash = await hashSessionSecret(sessionToken);
  const sessionId = createId("activation_session");
  const availableModel = channel.model || getEnv("PRESET_MODEL") || "preset-model";

  const rows = await sql`
    with selected_code as (
      select id, usage_limit, duration_hours
      from activation_codes
      where code = ${activationCode}
        and status = 'unused'
      for update
    ),
    inserted_session as (
      insert into activation_sessions (
        id,
        activation_code_id,
        session_hash,
        expires_at,
        usage_limit
      )
      select
        ${sessionId},
        selected_code.id,
        ${sessionHash},
        case
          when selected_code.duration_hours = 0 then null
          else now() + make_interval(hours => selected_code.duration_hours)
        end,
        selected_code.usage_limit
      from selected_code
      returning id, activation_code_id, expires_at, usage_limit, usage_count
    )
    update activation_codes
    set
      status = 'used',
      activated_at = now(),
      expires_at = inserted_session.expires_at,
      activation_session_id = inserted_session.id
    from inserted_session
    where activation_codes.id = inserted_session.activation_code_id
    returning inserted_session.expires_at, inserted_session.usage_limit, inserted_session.usage_count
  `;

  const row = rows[0] as
    | { expires_at: Date | string | null; usage_limit: number; usage_count: number }
    | undefined;
  if (!row) {
    throw new Error("激活码无效或已经使用。");
  }

  return {
    sessionToken,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
    availableModel,
    usageLimit: row.usage_limit,
    usageCount: row.usage_count,
  };
}

export async function verifyActivationSession(sessionToken: string, sql = createPostgresClient()) {
  const sessionHash = await hashSessionSecret(sessionToken);
  const rows = await sql`
    select id, expires_at, usage_limit, usage_count
    from activation_sessions
    where session_hash = ${sessionHash}
      and disabled_at is null
      and (expires_at is null or expires_at > now())
      and (usage_limit = 0 or usage_count < usage_limit)
    limit 1
  `;

  return rows[0] as
    | { id: string; expires_at: Date | string | null; usage_limit: number; usage_count: number }
    | undefined;
}

export async function incrementActivationUsage(sessionId: string, sql = createPostgresClient()) {
  await sql`
    update activation_sessions
    set usage_count = usage_count + 1
    where id = ${sessionId}
  `;
}

export async function disableActivationSession(id: string, sql = createPostgresClient()) {
  await sql`
    update activation_sessions
    set disabled_at = now()
    where id = ${id}
  `;
}

import type { ModelChannelSettings, PublicModelChannelStatus } from "./adminTypes";
import { createPostgresClient } from "../db/postgres";
import { getEnv } from "../runtime/env";

export async function getModelChannelSettings(
  sql = createPostgresClient(),
): Promise<ModelChannelSettings> {
  const rows = await sql`
    select preset_enabled, model, updated_at, updated_by
    from model_channel_settings
    where id = 'default'
    limit 1
  `;
  const row = rows[0] as
    | { preset_enabled: boolean; model: string; updated_at: Date | string; updated_by: string }
    | undefined;

  if (!row) {
    return {
      presetEnabled: false,
      model: getEnv("PRESET_MODEL") ?? "preset-model",
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    };
  }

  return {
    presetEnabled: row.preset_enabled,
    model: row.model,
    updatedAt: new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by,
  };
}

export async function saveModelChannelSettings(
  input: { presetEnabled: boolean; model: string; updatedBy: string },
  sql = createPostgresClient(),
) {
  await sql`
    insert into model_channel_settings (id, preset_enabled, model, updated_by)
    values ('default', ${input.presetEnabled}, ${input.model}, ${input.updatedBy})
    on conflict (id)
    do update set
      preset_enabled = excluded.preset_enabled,
      model = excluded.model,
      updated_at = now(),
      updated_by = excluded.updated_by
  `;

  return getModelChannelSettings(sql);
}

export async function getPublicModelChannelStatus(
  sql = createPostgresClient(),
): Promise<PublicModelChannelStatus> {
  const settings = await getModelChannelSettings(sql);
  return {
    presetEnabled: settings.presetEnabled,
    model: settings.presetEnabled ? settings.model : undefined,
  };
}

export interface AdminSession {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  actor: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ModelChannelSettings {
  presetEnabled: boolean;
  model: string;
  updatedAt: string;
  updatedBy: string;
}

export interface PublicModelChannelStatus {
  presetEnabled: boolean;
  model?: string;
}

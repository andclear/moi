export const ECHO_DB_NAME = "echo-local";
export const ECHO_DB_VERSION = 1;

export const ECHO_DB_STORES = {
  settings: "&key, updatedAt",
  activations: "&id, status, expiresAt, updatedAt",
  adminSettings: "&key, updatedAt",
  projects: "&id, currentStep, createdAt, updatedAt, archivedAt",
  histories: "&id, projectId, step, createdAt",
  generations: "&id, projectId, type, status, createdAt, updatedAt",
  exports: "&id, projectId, format, createdAt",
} as const;

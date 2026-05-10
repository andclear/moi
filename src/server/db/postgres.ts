import { neon } from "@neondatabase/serverless";

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

export function getDatabaseUrl() {
  return (globalThis as RuntimeGlobal).process?.env?.DATABASE_URL;
}

export function createPostgresClient(connectionString = getDatabaseUrl()) {
  if (!connectionString) {
    throw new Error("缺少 DATABASE_URL，无法连接 Neon PostgreSQL。");
  }

  return neon(connectionString);
}

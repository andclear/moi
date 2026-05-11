import { neon } from "@neondatabase/serverless";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

function stripQuotes(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function readLocalEnvValue(name: string) {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return undefined;
  }

  const match = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${name}=`));

  return match ? stripQuotes(match.slice(name.length + 1)) : undefined;
}

function isValidDatabaseUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" || url.protocol === "postgres:";
  } catch {
    return false;
  }
}

function redactDatabaseUrl(value: string) {
  return value.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@/]+(@?)/, "$1***$2");
}

export function getDatabaseUrl() {
  const runtimeValue = (globalThis as RuntimeGlobal).process?.env?.DATABASE_URL;
  if (isValidDatabaseUrl(runtimeValue)) {
    return runtimeValue;
  }

  const localValue = readLocalEnvValue("DATABASE_URL");
  if (isValidDatabaseUrl(localValue)) {
    return localValue;
  }

  return runtimeValue ?? localValue;
}

export function createPostgresClient(connectionString = getDatabaseUrl()) {
  if (!connectionString) {
    throw new Error("缺少 DATABASE_URL，无法连接 Neon PostgreSQL。");
  }
  if (!isValidDatabaseUrl(connectionString)) {
    throw new Error(
      `DATABASE_URL 不是合法的 PostgreSQL URL：${redactDatabaseUrl(connectionString)}`,
    );
  }

  return neon(connectionString);
}

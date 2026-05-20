type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

export function getEnv(name: string) {
  const value = (globalThis as RuntimeGlobal).process?.env?.[name];
  return value?.trim().replace(/^["']|["']$/g, "");
}

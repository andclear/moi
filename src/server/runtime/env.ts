type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

export function getEnv(name: string) {
  return (globalThis as RuntimeGlobal).process?.env?.[name];
}

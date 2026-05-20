const forbiddenCharacterJsonKeys = new Set(["createdAt", "updatedAt"]);

export function stripRuntimeTimestamps<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripRuntimeTimestamps(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !forbiddenCharacterJsonKeys.has(key))
        .map(([key, item]) => [key, stripRuntimeTimestamps(item)]),
    ) as T;
  }

  return value;
}

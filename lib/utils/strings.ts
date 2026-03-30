export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function pickString(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

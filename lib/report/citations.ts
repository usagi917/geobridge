import type { Source, ErrorEntry } from "./schema";

export class CitationTracker {
  private sources: Source[] = [];
  private errors: ErrorEntry[] = [];

  addSource(name: string, url: string | undefined, status: Source["status"]): void {
    this.sources.push({
      name,
      url,
      fetched_at: new Date().toISOString(),
      status,
      count: 1,
    });
  }

  addError(source: string, tool: string, message: string): void {
    this.errors.push({
      source,
      tool,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  getSources(): Source[] {
    const aggregated = new Map<string, Source>();

    for (const source of this.sources) {
      const key = `${source.name}\u0000${source.url ?? ""}`;
      const existing = aggregated.get(key);

      if (!existing) {
        aggregated.set(key, { ...source });
        continue;
      }

      existing.status = pickWorseStatus(existing.status, source.status);
      existing.count += source.count;
      if (source.fetched_at > existing.fetched_at) {
        existing.fetched_at = source.fetched_at;
      }
    }

    return Array.from(aggregated.values());
  }

  getErrors(): ErrorEntry[] {
    return [...this.errors];
  }
}

export function pickWorseStatus(current: Source["status"], next: Source["status"]): Source["status"] {
  const severity: Record<Source["status"], number> = {
    success: 0,
    partial: 1,
    failed: 2,
  };

  return severity[next] > severity[current] ? next : current;
}

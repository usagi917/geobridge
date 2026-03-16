import type { DpfResults } from "../mcp/types";
import type { NormalizedDpf } from "./index";

export function normalizeDpf(raw: DpfResults): NormalizedDpf {
  const result: NormalizedDpf = {};

  if (raw.search_results) {
    try {
      const data = raw.search_results as Record<string, unknown>;
      const items = (Array.isArray(data) ? data : (data.results || [])) as Array<Record<string, unknown>>;
      result.related_data = items.slice(0, 5).map(item => ({
        title: String(item.title || item.name || ""),
        description: String(item.description || ""),
      }));
    } catch {
      result.related_data = [];
    }
  }

  return result;
}

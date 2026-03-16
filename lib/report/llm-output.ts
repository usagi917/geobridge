import type { SectionContent } from "./schema";

export interface StructuredReportOutput {
  summary: SectionContent;
  disaster_safety: SectionContent;
  livability: SectionContent;
  environment: SectionContent;
  regional_context: SectionContent;
  data_gaps: SectionContent;
}

export const STRUCTURED_REPORT_SECTION_KEYS = [
  "summary",
  "disaster_safety",
  "livability",
  "environment",
  "regional_context",
  "data_gaps",
] as const;

type StructuredReportSectionKey = (typeof STRUCTURED_REPORT_SECTION_KEYS)[number];

export function createEmptySection(): SectionContent {
  return { facts: [], gaps: [], risks: [] };
}

export function createEmptyStructuredReportOutput(): StructuredReportOutput {
  return {
    summary: createEmptySection(),
    disaster_safety: createEmptySection(),
    livability: createEmptySection(),
    environment: createEmptySection(),
    regional_context: createEmptySection(),
    data_gaps: createEmptySection(),
  };
}

export function hasSectionContent(section: SectionContent | undefined): boolean {
  if (!section) return false;
  return section.facts.length > 0 || section.gaps.length > 0 || section.risks.length > 0;
}

export function hasStructuredReportContent(output: StructuredReportOutput): boolean {
  return STRUCTURED_REPORT_SECTION_KEYS.some((key) => hasSectionContent(output[key]));
}

export function parseStructuredReportOutput(
  rawText: string
): { output: StructuredReportOutput | null; source: "json" | "section-salvage" | null } {
  const candidates = extractJsonCandidates(rawText);

  for (const candidate of candidates) {
    const parsed = tryParseStructuredJson(candidate);
    if (parsed) {
      return { output: parsed, source: "json" };
    }
  }

  const salvaged = salvageStructuredReportOutput(rawText);
  if (hasStructuredReportContent(salvaged)) {
    return { output: salvaged, source: "section-salvage" };
  }

  return { output: null, source: null };
}

function tryParseStructuredJson(candidate: string): StructuredReportOutput | null {
  const attempts = Array.from(new Set([candidate.trim(), repairJsonCandidate(candidate)]))
    .filter((value) => value.length > 0);

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      const normalized = normalizeStructuredReportOutput(parsed);
      if (normalized) {
        return normalized;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeStructuredReportOutput(raw: unknown): StructuredReportOutput | null {
  if (!raw || typeof raw !== "object") return null;

  const root = unwrapStructuredReportRoot(raw as Record<string, unknown>);
  if (!root) return null;

  const output: StructuredReportOutput = {
    summary: normalizeSection(root.summary),
    disaster_safety: normalizeSection(root.disaster_safety),
    livability: normalizeSection(root.livability),
    environment: normalizeSection(root.environment),
    regional_context: normalizeSection(root.regional_context),
    data_gaps: normalizeSection(root.data_gaps),
  };

  return hasStructuredReportContent(output) ? output : null;
}

function unwrapStructuredReportRoot(
  root: Record<string, unknown>
): Record<string, unknown> | null {
  if (containsStructuredSections(root)) {
    return root;
  }

  if (root.sections && typeof root.sections === "object") {
    const nested = root.sections as Record<string, unknown>;
    if (containsStructuredSections(nested)) {
      return nested;
    }
  }

  if (root.report && typeof root.report === "object") {
    const nested = root.report as Record<string, unknown>;
    if (containsStructuredSections(nested)) {
      return nested;
    }
  }

  return null;
}

function containsStructuredSections(value: Record<string, unknown>): boolean {
  return STRUCTURED_REPORT_SECTION_KEYS.some((key) => key in value);
}

function normalizeSection(raw: unknown): SectionContent {
  if (typeof raw === "string") {
    return { facts: [raw.trim()].filter(Boolean), gaps: [], risks: [] };
  }

  if (Array.isArray(raw)) {
    return { facts: coerceStringArray(raw), gaps: [], risks: [] };
  }

  if (!raw || typeof raw !== "object") {
    return createEmptySection();
  }

  const section = raw as Record<string, unknown>;

  return {
    facts: coerceStringArray(section.facts),
    gaps: coerceStringArray(section.gaps),
    risks: coerceStringArray(section.risks),
  };
}

function coerceStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(stringifyListItem)
    .filter((item): item is string => typeof item === "string" && item.length > 0);
}

function stringifyListItem(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const preferredKeys = ["text", "description", "message", "content", "label", "value"];

  for (const key of preferredKeys) {
    const field = candidate[key];
    if (typeof field === "string" && field.trim().length > 0) {
      return field.trim();
    }
  }

  return null;
}

function salvageStructuredReportOutput(rawText: string): StructuredReportOutput {
  const output = createEmptyStructuredReportOutput();

  for (const key of STRUCTURED_REPORT_SECTION_KEYS) {
    const sectionText = extractNamedObject(rawText, key);
    if (!sectionText) continue;

    const section = tryParseStructuredSection(sectionText) ?? extractSectionArrays(sectionText);
    if (section) {
      output[key] = section;
    }
  }

  return output;
}

function tryParseStructuredSection(sectionText: string): SectionContent | null {
  const attempts = Array.from(new Set([sectionText.trim(), repairJsonCandidate(sectionText)]))
    .filter((value) => value.length > 0);

  for (const attempt of attempts) {
    try {
      return normalizeSection(JSON.parse(attempt) as unknown);
    } catch {
      continue;
    }
  }

  return null;
}

function extractSectionArrays(sectionText: string): SectionContent {
  return {
    facts: extractNamedStringArray(sectionText, "facts"),
    gaps: extractNamedStringArray(sectionText, "gaps"),
    risks: extractNamedStringArray(sectionText, "risks"),
  };
}

function extractNamedStringArray(text: string, field: "facts" | "gaps" | "risks"): string[] {
  const match = new RegExp(`"${field}"\\s*:\\s*\\[`, "i").exec(text)
    ?? new RegExp(`${field}\\s*:\\s*\\[`, "i").exec(text);

  if (!match) return [];

  const start = text.indexOf("[", match.index);
  if (start === -1) return [];

  const end = findMatchingDelimiter(text, start, "[", "]");
  if (end === -1) return [];

  try {
    const parsed = JSON.parse(repairJsonCandidate(text.slice(start, end + 1))) as unknown;
    return coerceStringArray(parsed);
  } catch {
    return [];
  }
}

function extractNamedObject(text: string, key: StructuredReportSectionKey): string | null {
  const match = new RegExp(`"${key}"\\s*:\\s*\\{`, "i").exec(text)
    ?? new RegExp(`${key}\\s*:\\s*\\{`, "i").exec(text);

  if (!match) return null;

  const start = text.indexOf("{", match.index);
  if (start === -1) return null;

  const end = findMatchingDelimiter(text, start, "{", "}");
  if (end === -1) return null;

  return text.slice(start, end + 1);
}

function extractJsonCandidates(rawText: string): string[] {
  const candidates = new Set<string>();
  const trimmed = rawText.trim();

  if (trimmed) {
    candidates.add(trimmed);
    const stripped = stripCodeFences(trimmed);
    if (stripped) {
      candidates.add(stripped);
    }
  }

  const fencedPattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of trimmed.matchAll(fencedPattern)) {
    const candidate = match[1]?.trim();
    if (candidate) {
      candidates.add(candidate);
    }
  }

  for (const block of extractBalancedObjects(trimmed)) {
    candidates.add(block);
  }

  return Array.from(candidates).filter((value) => value.length > 0);
}

function stripCodeFences(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function repairJsonCandidate(value: string): string {
  return stripCodeFences(value)
    .replace(/^[Jj][Ss][Oo][Nn]\s*/, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function extractBalancedObjects(text: string): string[] {
  const objects: string[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "{") continue;

    const end = findMatchingDelimiter(text, index, "{", "}");
    if (end === -1) continue;

    objects.push(text.slice(index, end + 1));
  }

  return objects;
}

function findMatchingDelimiter(
  text: string,
  startIndex: number,
  openChar: "{" | "[",
  closeChar: "}" | "]"
): number {
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === "\\") {
        isEscaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

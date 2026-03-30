import { coerceNumericValue } from "../coerce-number";
import { formatPrecipitation } from "../utils/format";
import { uniqueStrings } from "../utils/strings";
import type { Report, SectionContent } from "./schema";
import {
  hasSectionContent,
  parseStructuredReportOutput,
  type StructuredReportOutput,
} from "./llm-output";

export function recoverSectionsForDisplay(
  report: Report
): Report["sections"] {
  try {
    const sections = report.sections;
    const rawDump = sections.summary.facts.find(looksLikeStructuredDump);
    if (!rawDump) return sections;

    const recovered = parseStructuredReportOutput(rawDump).output;
    if (!recovered) {
      return {
        ...sections,
        summary: buildLegacySummaryFallback(sections.summary),
        data_gaps: {
          ...sections.data_gaps,
          gaps: uniqueStrings([
            "保存済みレポート内の生JSONを省略しました。再生成すると改善します。",
            ...sections.data_gaps.gaps,
          ]),
        },
      };
    }

    return {
      summary: pickDisplaySection(stripStructuredDump(sections.summary), recovered.summary),
      disaster_safety: pickDisplaySection(sections.disaster_safety, recovered.disaster_safety),
      livability: pickDisplaySection(sections.livability, recovered.livability),
      environment: pickDisplaySection(sections.environment, recovered.environment),
      regional_context: pickDisplaySection(sections.regional_context, recovered.regional_context),
      data_gaps: mergeDisplayDataGaps(sections.data_gaps, recovered),
    };
  } catch (error) {
    console.error("[display-recovery] Failed to recover sections:", error);
    return report.sections;
  }
}

function looksLikeStructuredDump(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") && trimmed.includes("\"summary\"") && trimmed.includes("\"facts\"");
}

function stripStructuredDump(section: SectionContent): SectionContent {
  return {
    ...section,
    facts: section.facts.filter((fact) => !looksLikeStructuredDump(fact)),
  };
}

function formatPrecipitationMetric(value: number): string {
  return `${formatPrecipitation(value)}mm`;
}

function buildLegacySummaryFallback(
  summary: Report["sections"]["summary"]
): Report["sections"]["summary"] {
  const cleaned = stripStructuredDump(summary);
  if (hasSectionContent(cleaned)) {
    return cleaned;
  }

  const facts: string[] = [];
  const data = summary.data;
  const elevationMean = coerceNumericValue(data?.elevation?.mean);
  const landPrice = data?.land_price?.points?.find((point) => {
    const price = coerceNumericValue(point?.price);
    return price !== undefined && price > 0;
  });
  const lstMean = coerceNumericValue(data?.lst?.mean);
  const ndviMean = coerceNumericValue(data?.ndvi?.mean);
  const precipitationMean = coerceNumericValue(data?.precipitation?.mean);

  if (elevationMean !== undefined) {
    facts.push(`平均標高は ${elevationMean.toFixed(1)}m です。`);
  }
  if (landPrice?.price !== undefined) {
    facts.push(`代表的な地価データは ${landPrice.price.toLocaleString("ja-JP")}円/m² です。`);
  }
  if (lstMean !== undefined) {
    facts.push(`地表面温度の平均は ${lstMean.toFixed(1)}°C です。`);
  }
  if (ndviMean !== undefined) {
    facts.push(`NDVI の平均は ${ndviMean.toFixed(3)} です。`);
  }
  if (precipitationMean !== undefined) {
    facts.push(`対象月の降水量は ${formatPrecipitationMetric(precipitationMean)} です。`);
  }

  return {
    ...cleaned,
    facts: facts.length > 0
      ? facts
      : ["構造化された要約を復元できなかったため、主要指標のみ表示しています。"],
    gaps: uniqueStrings([
      "保存済みレポートの要約テキストを復元できなかったため、主要指標から簡易表示しています。",
      ...cleaned.gaps,
    ]),
  };
}

function pickDisplaySection(
  current: SectionContent,
  recovered: StructuredReportOutput[keyof StructuredReportOutput]
): SectionContent {
  return hasSectionContent(current) ? current : recovered;
}

function mergeDisplayDataGaps(
  current: SectionContent,
  recovered: StructuredReportOutput
): SectionContent {
  return {
    facts: uniqueStrings([...current.facts, ...recovered.data_gaps.facts]),
    gaps: uniqueStrings([
      "保存済みレポート内の生JSONを自動復元して表示しています。",
      ...current.gaps,
      ...recovered.data_gaps.gaps,
    ]),
    risks: uniqueStrings([...current.risks, ...recovered.data_gaps.risks]),
  };
}

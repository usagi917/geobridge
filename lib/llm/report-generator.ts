import { generateWithOllama } from "./ollama";
import { isOpenAIAvailable, generateWithOpenAI } from "./openai";
import { getSystemPrompt, buildUserPrompt } from "./prompts";
import type { NormalizedData } from "../normalizer";
import type { Perspective } from "../config";
import { formatPrecipitation } from "../utils/format";
import {
  createEmptySection,
  hasSectionContent,
  parseStructuredReportOutput,
  type StructuredReportOutput,
} from "../report/llm-output";
import { sanitizeLandPricePoints, sanitizeLandPriceHistory } from "../report/sanitize";
import { uniqueStrings } from "../utils/strings";

export type LLMReportOutput = StructuredReportOutput;

type JaxaTimeseriesCollection = NonNullable<NonNullable<NormalizedData["jaxa"]>["timeseries"]>;
type JaxaTimeseriesEntry = NonNullable<JaxaTimeseriesCollection[keyof JaxaTimeseriesCollection]>;

export async function generateReport(
  normalizedData: NormalizedData,
  address: string,
  perspective: Perspective
): Promise<LLMReportOutput> {
  const systemPrompt = getSystemPrompt(perspective);
  const llmInput = buildLlmInput(normalizedData);
  const userPrompt = buildUserPrompt(
    JSON.stringify(llmInput, null, 2),
    address
  );

  // Stage 1: Ollama
  try {
    const response = await generateWithOllama(userPrompt, systemPrompt, {
      temperature: 0.3,
    });
    return parseLLMResponse(response, normalizedData, address);
  } catch (ollamaError) {
    const ollamaReason = ollamaError instanceof Error ? ollamaError.message : "Ollama failed";
    console.warn(`[report-generator] Ollama failed: ${ollamaReason}`);

    // Stage 2: OpenAI fallback
    if (isOpenAIAvailable()) {
      try {
        console.info("[report-generator] Falling back to OpenAI");
        const response = await generateWithOpenAI(userPrompt, systemPrompt, {
          reasoningEffort: "low",
          verbosity: "low",
        });
        return parseLLMResponse(response, normalizedData, address);
      } catch (openaiError) {
        const openaiReason = openaiError instanceof Error ? openaiError.message : "OpenAI failed";
        console.warn(`[report-generator] OpenAI fallback failed: ${openaiReason}`);
        return createDataDrivenFallback(normalizedData, address, `Ollama: ${ollamaReason} / OpenAI: ${openaiReason}`);
      }
    }

    // Stage 3: data-driven fallback
    return createDataDrivenFallback(normalizedData, address, ollamaReason);
  }
}

function parseLLMResponse(
  response: string,
  normalizedData: NormalizedData,
  address: string
): LLMReportOutput {
  const parsed = parseStructuredReportOutput(response);

  if (parsed.output && parsed.source === "json") {
    return parsed.output;
  }

  const fallback = createDataDrivenFallback(
    normalizedData,
    address,
    "LLM出力を完全には構造化できませんでした"
  );

  if (!parsed.output) {
    return fallback;
  }

  return {
    summary: pickSection(parsed.output.summary, fallback.summary),
    disaster_safety: pickSection(parsed.output.disaster_safety, fallback.disaster_safety),
    livability: pickSection(parsed.output.livability, fallback.livability),
    environment: pickSection(parsed.output.environment, fallback.environment),
    regional_context: pickSection(parsed.output.regional_context, fallback.regional_context),
    data_gaps: mergeDataGapSections(parsed.output.data_gaps, fallback.data_gaps),
  };
}

function hasMeaningfulContent(section: LLMReportOutput[keyof LLMReportOutput]): boolean {
  return hasSectionContent(section) && section.facts.some((fact) => fact.length >= 10);
}

function pickSection(
  primary: LLMReportOutput[keyof LLMReportOutput],
  fallback: LLMReportOutput[keyof LLMReportOutput]
): LLMReportOutput[keyof LLMReportOutput] {
  return hasMeaningfulContent(primary) ? primary : fallback;
}

function mergeDataGapSections(
  primary: LLMReportOutput["data_gaps"],
  fallback: LLMReportOutput["data_gaps"]
): LLMReportOutput["data_gaps"] {
  const autoRecoveredMessage = "LLM出力を一部補正し、復元できた内容と取得済みデータを組み合わせて表示しています。";

  return {
    facts: uniqueStrings([...primary.facts, ...fallback.facts]),
    gaps: uniqueStrings([autoRecoveredMessage, ...primary.gaps, ...fallback.gaps]),
    risks: uniqueStrings([...primary.risks, ...fallback.risks]),
  };
}

function createDataDrivenFallback(
  normalizedData: NormalizedData,
  address: string,
  reason: string
): LLMReportOutput {
  const summary = createEmptySection();
  const disasterSafety = createEmptySection();
  const livability = createEmptySection();
  const environment = createEmptySection();
  const regionalContext = createEmptySection();
  const dataGaps = createEmptySection();

  const elevationMean = normalizedData.jaxa?.elevation?.mean;
  if (typeof elevationMean === "number") {
    summary.facts.push(`対象地点 ${address} 周辺の平均標高は約 ${formatNumber(elevationMean)}${normalizedData.jaxa?.elevation?.unit ?? "m"} です。`);
  }

  const landPricePoint = sanitizeLandPricePoints(normalizedData.geospatial?.land_price?.points)[0];
  if (landPricePoint?.price) {
    summary.facts.push(`取得できた地価公示・地価調査データでは、代表地点の価格は ${landPricePoint.price.toLocaleString("ja-JP")} 円/m2 です。`);
  }

  // Build a combined summary line from zoning + area class + land price
  const zoningName = normalizedData.geospatial?.zoning?.name;
  const areaClass = normalizedData.geospatial?.urban_planning?.area_class;
  if (zoningName || areaClass) {
    const parts: string[] = [];
    if (areaClass) parts.push(`区域区分「${areaClass}」`);
    if (zoningName) parts.push(`用途地域「${zoningName}」`);
    if (landPricePoint?.price) parts.push(`地価 ${landPricePoint.price.toLocaleString("ja-JP")} 円/m2`);
    summary.facts.push(`${address} は ${parts.join("、")} に該当する地域です。`);
  }

  if (normalizedData.geospatial?.urban_planning?.area_class) {
    regionalContext.facts.push(`都市計画区域区分は「${normalizedData.geospatial.urban_planning.area_class}」です。`);
  }

  if (normalizedData.geospatial?.zoning?.name) {
    regionalContext.facts.push(`用途地域は「${normalizedData.geospatial.zoning.name}」です。`);
  }

  const facilities = normalizedData.geospatial?.facilities;
  if (facilities) {
    if (typeof facilities.schools === "number") {
      livability.facts.push(`周辺の学校は ${facilities.schools} 件です。`);
    }
    if (typeof facilities.nurseries === "number") {
      livability.facts.push(`周辺の保育園・幼稚園等は ${facilities.nurseries} 件です。`);
    }
    if (typeof facilities.hospitals === "number") {
      livability.facts.push(`周辺の医療機関は ${facilities.hospitals} 件です。`);
    }
    if (typeof facilities.libraries === "number") {
      livability.facts.push(`周辺の図書館は ${facilities.libraries} 件です。`);
    }
    if (typeof facilities.welfare === "number") {
      livability.facts.push(`周辺の福祉施設は ${facilities.welfare} 件です。`);
    }
  }

  const disaster = normalizedData.geospatial?.disaster;
  if (disaster) {
    if (disaster.liquefaction?.risk_level) {
      disasterSafety.facts.push(`液状化リスク: ${disaster.liquefaction.risk_level}。`);
    }
    if (typeof disaster.landslide?.designated === "boolean") {
      disasterSafety.facts.push(`地すべり防止地区の指定は ${formatBoolean(disaster.landslide.designated)} です。`);
    }
    if (typeof disaster.steep_slope?.designated === "boolean") {
      disasterSafety.facts.push(`急傾斜地崩壊危険区域の指定は ${formatBoolean(disaster.steep_slope.designated)} です。`);
    }
    if (typeof disaster.large_fill?.designated === "boolean") {
      disasterSafety.facts.push(`大規模盛土造成地マップの該当は ${formatBoolean(disaster.large_fill.designated)} です。`);
    }
    if (typeof disaster.disaster_zone?.designated === "boolean") {
      disasterSafety.facts.push(`災害危険区域の指定は ${formatBoolean(disaster.disaster_zone.designated)} です。`);
    }

    // Add overall assessment when all disaster indicators are low
    const allLow =
      (!disaster.landslide || !disaster.landslide.designated) &&
      (!disaster.steep_slope || !disaster.steep_slope.designated) &&
      (!disaster.large_fill || !disaster.large_fill.designated) &&
      (!disaster.disaster_zone || !disaster.disaster_zone.designated);
    if (allLow && disasterSafety.facts.length > 0) {
      disasterSafety.facts.push("取得済みの災害指定データでは、地すべり・急傾斜地・大規模盛土・災害危険区域のいずれにも該当しません。");
    }
  }

  if (typeof normalizedData.jaxa?.ndvi?.mean === "number") {
    environment.facts.push(`NDVI の平均値は ${formatNumber(normalizedData.jaxa.ndvi.mean, 3)} です。`);
  }
  if (typeof normalizedData.jaxa?.lst?.mean === "number") {
    environment.facts.push(`地表面温度の平均値は ${formatNumber(normalizedData.jaxa.lst.mean)}${normalizedData.jaxa.lst.unit ?? "℃"} です。`);
  }
  if (typeof normalizedData.jaxa?.precipitation?.mean === "number") {
    environment.facts.push(`対象月の降水量（月平均）は ${formatPrecipitationValue(normalizedData.jaxa.precipitation.mean)}${normalizedData.jaxa.precipitation.unit ?? "mm"} です。`);
  }

  if (typeof normalizedData.geospatial?.population?.current === "number") {
    regionalContext.facts.push(`推計人口 250m メッシュの現在人口は ${normalizedData.geospatial.population.current.toLocaleString("ja-JP")} 人です。`);
  }
  if (typeof normalizedData.geospatial?.population?.forecast === "number" && normalizedData.geospatial.population.forecast > 0) {
    regionalContext.facts.push(`同メッシュの将来推計人口は ${normalizedData.geospatial.population.forecast.toLocaleString("ja-JP")} 人です。`);
  }

  if (normalizedData.dpf?.related_data?.length) {
    livability.facts.push(`関連行政データとして ${normalizedData.dpf.related_data.length} 件の候補情報を取得しました。`);
  }

  const missingDomains = [
    summary.facts.length === 0 ? "総合サマリー" : null,
    disasterSafety.facts.length === 0 ? "災害・安全性" : null,
    livability.facts.length === 0 ? "暮らしやすさ" : null,
    environment.facts.length === 0 ? "自然環境" : null,
    regionalContext.facts.length === 0 ? "地域コンテキスト" : null,
  ].filter((value): value is string => value !== null);

  if (missingDomains.length > 0) {
    dataGaps.gaps.push(`取得済みデータが不足しているため、${missingDomains.join("、")} の記述は限定的です。`);
  }

  dataGaps.gaps.push(`AI レポート生成が失敗したため、取得済みデータから簡易レポートを生成しました。理由: ${reason}`);
  dataGaps.risks.push("簡易レポートでは文脈的な要約を省略しているため、必要に応じて再実行または追加調査が必要です。");

  if (summary.facts.length === 0) {
    summary.facts.push("取得済みデータから要約可能な主要指標は限定的でした。");
  }
  summary.gaps.push("AI による文章要約を完了できなかったため、定型フォールバックを表示しています。");

  return {
    summary,
    disaster_safety: disasterSafety,
    livability,
    environment,
    regional_context: regionalContext,
    data_gaps: dataGaps,
  };
}

function buildLlmInput(normalizedData: NormalizedData): Record<string, unknown> {
  return {
    input: normalizedData.input,
    jaxa: normalizedData.jaxa ? {
      elevation: normalizedData.jaxa.elevation,
      ndvi: normalizedData.jaxa.ndvi,
      lst: normalizedData.jaxa.lst,
      precipitation: normalizedData.jaxa.precipitation,
      visualizations: normalizedData.jaxa.visualizations?.map((visualization) => ({
        id: visualization.id,
        title: visualization.title,
        description: visualization.description,
        capturedRange: visualization.capturedRange,
        mean: visualization.mean,
        min: visualization.min,
        max: visualization.max,
        unit: visualization.unit,
        valueLabel: visualization.valueLabel,
      })),
      timeseries: summarizeTimeseries(normalizedData.jaxa.timeseries),
    } : undefined,
    geospatial: normalizedData.geospatial ? {
      land_price: (() => {
        const points = sanitizeLandPricePoints(normalizedData.geospatial?.land_price?.points).slice(0, 3);
        return points.length > 0 ? { points } : undefined;
      })(),
      zoning: normalizedData.geospatial.zoning,
      urban_planning: normalizedData.geospatial.urban_planning,
      disaster: normalizedData.geospatial.disaster,
      facilities: normalizedData.geospatial.facilities,
      population: normalizedData.geospatial.population,
      land_price_history: sanitizeLandPriceHistory(normalizedData.geospatial.land_price_history).slice(-10),
    } : undefined,
    dpf: normalizedData.dpf,
  };
}

function summarizeTimeseries(
  timeseries: JaxaTimeseriesCollection | undefined
): Record<string, unknown> | undefined {
  if (!timeseries) return undefined;

  const summarized = {
    ndvi: summarizeTimeseriesEntry(timeseries.ndvi),
    lst: summarizeTimeseriesEntry(timeseries.lst),
    precipitation: summarizeTimeseriesEntry(timeseries.precipitation),
  };

  return Object.values(summarized).some((entry) => entry !== undefined) ? summarized : undefined;
}

function summarizeTimeseriesEntry(
  entry: JaxaTimeseriesEntry | undefined
): Record<string, unknown> | undefined {
  if (!entry || entry.data.length === 0) return undefined;

  const data = entry.data
    .filter((point: JaxaTimeseriesEntry["data"][number]) => Number.isFinite(point.mean))
    .sort((a: JaxaTimeseriesEntry["data"][number], b: JaxaTimeseriesEntry["data"][number]) => a.date.localeCompare(b.date));

  if (data.length === 0) return undefined;

  const latest = data[data.length - 1];
  const recent = data.slice(-12);
  const means = data.map((point: JaxaTimeseriesEntry["data"][number]) => point.mean);

  return {
    label: entry.label,
    unit: entry.unit,
    count: data.length,
    period: {
      start: data[0].date,
      end: latest.date,
    },
    latest,
    recent,
    min_mean: Math.min(...means),
    max_mean: Math.max(...means),
  };
}

function formatBoolean(value: boolean): string {
  return value ? "あり" : "なし";
}

function formatNumber(value: number, maximumFractionDigits: number = 1): string {
  return value.toLocaleString("ja-JP", { maximumFractionDigits });
}

function formatPrecipitationValue(value: number): string {
  return formatPrecipitation(value);
}

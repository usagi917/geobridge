import { randomUUID } from "crypto";
import type { Report, ReportInput, SectionContent } from "./schema";
import type { CitationTracker } from "./citations";
import { sanitizeLandPricePoints, sanitizeLandPriceHistory } from "./sanitize";
import type { NormalizedData } from "../normalizer";
import type { LLMReportOutput } from "../llm/report-generator";
import type { GeneratedChart, GeneratedMap } from "../visualize/client";
import { generateLineChartImages, generateMapImages } from "../visualize/client";

interface AnnualPrecipitationPoint {
  year: number;
  total: number;
}

interface AnnualPrecipitationSeries {
  label: string;
  unit: string;
  data: AnnualPrecipitationPoint[];
}

export async function buildReport(
  input: ReportInput,
  normalizedData: NormalizedData,
  llmOutput: LLMReportOutput,
  citations: CitationTracker,
  generationTimeMs: number,
  model: string
): Promise<Report> {
  // Generate annotated map images from JAXA visualizations
  let generatedMaps: GeneratedMap[] = [];
  let generatedCharts: GeneratedChart[] = [];
  const visualizations = normalizedData.jaxa?.visualizations;
  const annualPrecipitation = buildAnnualPrecipitationSeries(
    normalizedData.jaxa?.timeseries?.precipitation?.data
  );

  if (visualizations && visualizations.length > 0) {
    generatedMaps = await generateMapImages(
      visualizations,
      [input.longitude, input.latitude]
    );
  }

  if (annualPrecipitation && annualPrecipitation.data.length > 0) {
    generatedCharts = await generateLineChartImages([
      {
        id: "annual-precipitation",
        title: "年間降水量推移",
        description: "月次降水量を年単位に合計した推移です。12か月揃った年のみ表示しています。",
        unit: annualPrecipitation.unit,
        points: annualPrecipitation.data.map((point) => ({
          label: String(point.year),
          value: point.total,
        })),
      },
    ]);
  }

  return {
    id: randomUUID(),
    input,
    sections: {
      summary: mergeSectionWithData(
        llmOutput.summary,
        normalizedData,
        generatedMaps,
        generatedCharts,
        annualPrecipitation
      ),
      disaster_safety: llmOutput.disaster_safety,
      livability: llmOutput.livability,
      environment: llmOutput.environment,
      regional_context: llmOutput.regional_context,
      data_gaps: llmOutput.data_gaps,
    },
    sources: citations.getSources(),
    errors: citations.getErrors(),
    generated_at: new Date().toISOString(),
    llm_model: model,
    generation_time_ms: generationTimeMs,
  };
}

function mergeSectionWithData(
  section: SectionContent,
  data: NormalizedData,
  generatedMaps: GeneratedMap[],
  generatedCharts: GeneratedChart[],
  annualPrecipitation?: AnnualPrecipitationSeries
): SectionContent {
  const landPricePoints = sanitizeLandPricePoints(data.geospatial?.land_price?.points);
  const landPriceHistory = sanitizeLandPriceHistory(data.geospatial?.land_price_history);

  return {
    ...section,
    data: {
      elevation: data.jaxa?.elevation,
      ndvi: data.jaxa?.ndvi,
      lst: data.jaxa?.lst,
      precipitation: data.jaxa?.precipitation,
      land_price: landPricePoints.length > 0 ? { points: landPricePoints } : undefined,
      perspective: data.input?.perspective,
      visualizations: data.jaxa?.visualizations ?? [],
      generated_maps: generatedMaps,
      generated_charts: generatedCharts,
      timeseries: data.jaxa?.timeseries,
      annual_precipitation: annualPrecipitation,
      land_price_history: landPriceHistory.length > 0 ? landPriceHistory : undefined,
      proximity: data.city2graph?.proximity,
      morphology: data.city2graph?.morphology,
      isochrone: data.city2graph?.isochrone,
    },
  };
}

function buildAnnualPrecipitationSeries(
  precipitationTimeseries?: Array<{ date: string; mean: number }>
): AnnualPrecipitationSeries | undefined {
  if (!precipitationTimeseries || precipitationTimeseries.length === 0) return undefined;

  const totalsByYear = new Map<number, { total: number; months: Set<string> }>();

  for (const point of precipitationTimeseries) {
    if (!Number.isFinite(point.mean)) continue;

    const [yearText, monthText] = point.date.split("-");
    const year = Number.parseInt(yearText ?? "", 10);
    if (!Number.isFinite(year) || !monthText) continue;

    const entry = totalsByYear.get(year) ?? { total: 0, months: new Set<string>() };
    entry.total += point.mean;
    entry.months.add(monthText);
    totalsByYear.set(year, entry);
  }

  const data = Array.from(totalsByYear.entries())
    .filter(([, entry]) => entry.months.size === 12)
    .map(([year, entry]) => ({
      year,
      total: Number(entry.total.toFixed(1)),
    }))
    .sort((a, b) => a.year - b.year);

  if (data.length === 0) return undefined;

  return {
    label: "年間降水量",
    unit: "mm/年",
    data,
  };
}


"use client";

import Link from "next/link";
import { coerceNumericValue } from "@/lib/coerce-number";
import type { Report } from "@/lib/report/schema";
import { aggregateSources } from "@/lib/report/citations";
import { recoverSectionsForDisplay } from "@/lib/report/display-recovery";
import { sanitizeLandPriceHistory as sanitizeLandPriceHistoryData } from "@/lib/report/sanitize";
import { formatPrecipitation } from "@/lib/utils/format";
import { ReportSection } from "./report-section";
import { SourceBadge } from "./source-badge";
import { ErrorSection } from "./error-section";
import {
  ChartSection,
  type TimeseriesEntry,
  type LandPricePoint,
  type AnnualPrecipitationEntry,
  type GeneratedChartEntry,
} from "./charts/chart-section";
import { LocationMap } from "./maps/location-map";
import { SatelliteOverlayMap } from "./maps/satellite-overlay-map";
import { City2GraphSection } from "./city2graph-section";
import type { ProximityResult, MorphologyResult, IsochroneResult, ProximityFacility } from "@/lib/city2graph/types";

interface ReportViewProps {
  report: Report;
}

const sectionConfig = [
  { key: "summary" as const, title: "総合サマリー", icon: "clipboard" },
  { key: "disaster_safety" as const, title: "災害・安全性", icon: "shield" },
  { key: "livability" as const, title: "暮らしやすさ", icon: "home" },
  { key: "environment" as const, title: "自然環境", icon: "tree" },
  { key: "regional_context" as const, title: "地域コンテキスト", icon: "map" },
  { key: "data_gaps" as const, title: "不足データと注意点", icon: "alert" },
];

const perspectiveLabels: Record<string, string> = {
  comprehensive: "総合",
  child_rearing: "子育て重視",
  disaster: "災害重視",
  livability: "生活利便重視",
};

export function ReportView({ report }: ReportViewProps) {
  const displaySections = recoverSectionsForDisplay(report);
  const summaryData = report.sections.summary.data;
  const visualizations = summaryData?.visualizations ?? [];
  const aggregatedSources = aggregateSources(report.sources);
  const elevationMean = coerceNumericValue(summaryData?.elevation?.mean);
  const precipitationMean = coerceNumericValue(summaryData?.precipitation?.mean);
  const lstMean = coerceNumericValue(summaryData?.lst?.mean);
  const ndviMean = coerceNumericValue(summaryData?.ndvi?.mean);
  const landPricePoint = summaryData?.land_price?.points?.find((point) => {
    const price = coerceNumericValue(point?.price);
    return price !== undefined && price > 0;
  });

  const timeseries = summaryData?.timeseries as ChartSectionTimeseries | undefined;
  const annualPrecipitation = summaryData?.annual_precipitation as AnnualPrecipitationEntry | undefined;
  const generatedCharts = summaryData?.generated_charts as GeneratedChartEntry[] | undefined;
  const landPriceHistoryRaw = sanitizeLandPriceHistoryData(
    summaryData?.land_price_history as LandPricePoint[] | undefined
  );
  const landPriceHistory = landPriceHistoryRaw.length > 0 ? landPriceHistoryRaw : undefined;
  const proximityData = summaryData?.proximity as ProximityResult | undefined;
  const morphologyData = summaryData?.morphology as MorphologyResult | undefined;
  const isochroneData = summaryData?.isochrone as IsochroneResult | undefined;

  // Flatten all proximity facilities for map markers
  const allFacilities: ProximityFacility[] = proximityData
    ? Object.values(proximityData.categories).flatMap((cat) => cat.facilities)
    : [];

  const precipitationCapturedRange = visualizations.find((visualization) => visualization.id === "precipitation")?.capturedRange;
  const precipitationCaption = precipitationCapturedRange
    ? `対象月 ${formatCapturedMonth(precipitationCapturedRange)}`
    : "対象月 直近確定月";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{report.input.address}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {report.input.latitude.toFixed(4)}, {report.input.longitude.toFixed(4)}
              </span>
              <span className="rounded-full bg-terra-50 text-terra-700 px-2 py-0.5">
                {perspectiveLabels[report.input.perspective] || report.input.perspective}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                半径 {report.input.radius_m}m
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                生成時間: {(report.generation_time_ms / 1000).toFixed(1)}秒
              </span>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-terra-300 hover:bg-terra-50 hover:text-terra-700"
          >
            ホームへ戻る
          </Link>
        </div>
      </div>

      {/* Key metrics */}
      {summaryData && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {elevationMean !== undefined && (
            <MetricCard label="標高" value={`${elevationMean.toFixed(1)}m`} />
          )}
          {precipitationMean !== undefined && (
            <MetricCard
              label="対象月降水量"
              value={formatPrecipitationMetric(precipitationMean)}
              caption={precipitationCaption}
            />
          )}
          {lstMean !== undefined && (
            <MetricCard label="地表面温度" value={`${lstMean.toFixed(1)}°C`} />
          )}
          {ndviMean !== undefined && (
            <MetricCard label="NDVI" value={ndviMean.toFixed(3)} />
          )}
          {landPricePoint?.price !== undefined && (
            <MetricCard
              label="地価"
              value={`${landPricePoint.price.toLocaleString("ja-JP")}円/m²`}
            />
          )}
          {proximityData && (
            <MetricCard label="生活利便" value={`${proximityData.score}/100`} />
          )}
          {morphologyData && (
            <MetricCard label="街区成熟度" value={`${morphologyData.maturity_score}/100`} />
          )}
        </div>
      )}

      {/* Interactive map */}
      <LocationMap
        latitude={report.input.latitude}
        longitude={report.input.longitude}
        radiusM={report.input.radius_m}
        proximityFacilities={allFacilities.length > 0 ? allFacilities : undefined}
      />

      {/* city2graph section */}
      <City2GraphSection
        proximity={proximityData ?? null}
        morphology={morphologyData ?? null}
        isochrone={isochroneData ?? null}
        facilities={allFacilities}
        lat={report.input.latitude}
        lng={report.input.longitude}
        radiusM={report.input.radius_m}
      />

      {/* Trend charts */}
      <ChartSection
        timeseries={timeseries}
        annualPrecipitation={annualPrecipitation}
        generatedCharts={generatedCharts}
        landPriceHistory={landPriceHistory}
      />

      {/* Satellite overlay maps */}
      {visualizations.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">衛星データオーバーレイ</h3>
            <p className="text-sm text-slate-500">
              JAXA 衛星データを OpenStreetMap 上に重ねて表示しています。スライダーで透過率を調整できます。
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {visualizations.map((vis) => (
              <SatelliteOverlayMap
                key={vis.id}
                imageDataUrl={vis.imageDataUrl}
                bbox={vis.bbox as [number, number, number, number]}
                title={vis.title}
                valueLabel={vis.valueLabel}
                capturedRange={vis.capturedRange as [string, string]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Report sections */}
      {sectionConfig.map(({ key, title }) => (
        <ReportSection
          key={key}
          title={title}
          content={displaySections[key]}
        />
      ))}

      {/* Errors */}
      {report.errors.length > 0 && (
        <ErrorSection errors={report.errors} />
      )}

      {/* Sources */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-3">出典一覧</h3>
        <div className="flex flex-wrap gap-2">
          {aggregatedSources.map((source, i) => (
            <SourceBadge key={i} source={source} />
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          生成日時: {new Date(report.generated_at).toLocaleString("ja-JP")}
          {" / "}モデル: {report.llm_model}
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-xl border border-l-4 border-l-terra-500 border-slate-200 bg-white p-4 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {caption ? (
        <div className="mt-1 text-[11px] text-slate-400">{caption}</div>
      ) : null}
    </div>
  );
}

function formatCapturedMonth([start, end]: [string, string]) {
  return start.slice(0, 7) === end.slice(0, 7)
    ? start.slice(0, 7)
    : `${start.slice(0, 10)} - ${end.slice(0, 10)}`;
}

function formatPrecipitationMetric(value: number): string {
  return `${formatPrecipitation(value)}mm`;
}

// Types re-exported from chart-section for local use
type ChartSectionTimeseries = {
  ndvi?: TimeseriesEntry;
  lst?: TimeseriesEntry;
  precipitation?: TimeseriesEntry;
};


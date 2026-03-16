"use client";

import Image from "next/image";
import { TrendChart } from "./trend-chart";
import { LandPriceChart } from "./land-price-chart";

interface TimeseriesEntry {
  label: string;
  unit: string;
  data: Array<{ date: string; mean: number; min?: number; max?: number }>;
}

interface LandPricePoint {
  year: number;
  price: number;
  address?: string;
}

interface AnnualPrecipitationEntry {
  label: string;
  unit: string;
  data: Array<{ year: number; total: number }>;
}

interface GeneratedChartEntry {
  id: string;
  title: string;
  description?: string;
  imageDataUrl: string;
}

interface ChartSectionProps {
  timeseries?: {
    ndvi?: TimeseriesEntry;
    lst?: TimeseriesEntry;
    precipitation?: TimeseriesEntry;
  };
  annualPrecipitation?: AnnualPrecipitationEntry;
  generatedCharts?: GeneratedChartEntry[];
  landPriceHistory?: LandPricePoint[];
}

const CHART_COLORS = {
  precipitation: "#3b82f6",
  lst: "#ef4444",
  ndvi: "#22c55e",
};

function NoDataPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
      <p className="text-sm text-slate-400">{label}: データ未取得</p>
    </div>
  );
}

function GeneratedChartCard({ chart }: { chart: GeneratedChartEntry }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-900">{chart.title}</h4>
        {chart.description ? (
          <p className="mt-1 text-xs text-slate-500">{chart.description}</p>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <Image
          src={chart.imageDataUrl}
          alt={chart.title}
          width={1200}
          height={720}
          unoptimized
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}

export function ChartSection({
  timeseries,
  annualPrecipitation,
  generatedCharts,
  landPriceHistory,
}: ChartSectionProps) {
  const hasTimeseries = timeseries && (timeseries.ndvi || timeseries.lst || timeseries.precipitation);
  const annualPrecipitationChart = generatedCharts?.find((chart) => chart.id === "annual-precipitation");
  const hasAnnualPrecipitation = annualPrecipitation && annualPrecipitation.data.length > 0;
  const hasLandPrice = landPriceHistory && landPriceHistory.length > 0;

  if (!hasTimeseries && !hasAnnualPrecipitation && !hasLandPrice) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-900">トレンド分析</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        {annualPrecipitationChart ? (
          <GeneratedChartCard chart={annualPrecipitationChart} />
        ) : hasAnnualPrecipitation ? (
          <NoDataPlaceholder label="年間降水量" />
        ) : null}

        {timeseries?.precipitation ? (
          <TrendChart
            title={timeseries.precipitation.label}
            data={timeseries.precipitation.data}
            unit={timeseries.precipitation.unit}
            color={CHART_COLORS.precipitation}
          />
        ) : hasTimeseries ? (
          <NoDataPlaceholder label="月次降水量" />
        ) : null}

        {timeseries?.lst ? (
          <TrendChart
            title={timeseries.lst.label}
            data={timeseries.lst.data}
            unit={timeseries.lst.unit}
            color={CHART_COLORS.lst}
          />
        ) : hasTimeseries ? (
          <NoDataPlaceholder label="地表面温度" />
        ) : null}

        {timeseries?.ndvi ? (
          <TrendChart
            title={timeseries.ndvi.label}
            data={timeseries.ndvi.data}
            unit={timeseries.ndvi.unit}
            color={CHART_COLORS.ndvi}
          />
        ) : hasTimeseries ? (
          <NoDataPlaceholder label="NDVI" />
        ) : null}

        {hasLandPrice ? (
          <LandPriceChart data={landPriceHistory} />
        ) : hasTimeseries ? (
          <NoDataPlaceholder label="地価" />
        ) : null}
      </div>
    </section>
  );
}

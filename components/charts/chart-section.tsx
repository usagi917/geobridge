"use client";

import Image from "next/image";
import { TrendChart } from "./trend-chart";
import { LandPriceChart } from "./land-price-chart";

export interface TimeseriesEntry {
  label: string;
  unit: string;
  data: Array<{ date: string; mean: number; min?: number; max?: number }>;
}

export interface LandPricePoint {
  year: number;
  price: number;
  address?: string;
}

export interface AnnualPrecipitationEntry {
  label: string;
  unit: string;
  data: Array<{ year: number; total: number }>;
}

export interface GeneratedChartEntry {
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Annual Snapshot</div>
          <h4 className="mt-1 text-base font-semibold text-slate-900">{chart.title}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {chart.description ?? "年単位の集計結果をまとめた静的グラフです。"}
          </p>
        </div>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
          画像グラフ
        </span>
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
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Trend Analysis</div>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">時系列チャート</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          降水量、地表面温度、植生、地価の変化を時系列で比較できるグラフ群です。各カード上部に、対象期間・単位・何を描いているかを明記しています。
        </p>
      </div>
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
            subtitle="月ごとの平均降水量の推移です。線は平均、帯は取得範囲がある場合の最小値から最大値を示します。"
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
            subtitle="月ごとの地表面温度の推移です。季節差や近年の温度変動を確認できます。"
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
            subtitle="月ごとの植生指数の推移です。値が高いほど周辺の植生が豊かな傾向を示します。"
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

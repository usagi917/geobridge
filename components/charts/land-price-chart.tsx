"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MetaChip, TooltipRow, LegendItem } from "./chart-primitives";

interface LandPricePoint {
  year: number;
  price: number;
  address?: string;
}

interface LandPriceChartProps {
  data: LandPricePoint[];
}

interface ChartDataPoint extends LandPricePoint {
  changeRate: number | null;
}

function formatPrice(price: number): string {
  if (price >= 10000) {
    return `${(price / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万`;
  }
  return price.toLocaleString("ja-JP");
}

export function LandPriceChart({ data }: LandPriceChartProps) {
  if (data.length === 0) return null;

  // Compute year-over-year change rate
  const chartData: ChartDataPoint[] = data.map((point, i) => {
    const prevPrice = i > 0 ? data[i - 1].price : null;
    const changeRate = prevPrice ? ((point.price - prevPrice) / prevPrice) * 100 : null;
    return {
      ...point,
      changeRate,
    };
  });
  const latestPoint = chartData[chartData.length - 1];
  const changeRates = chartData
    .map((point) => point.changeRate)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const minRate = changeRates.length > 0 ? Math.min(...changeRates) : -5;
  const maxRate = changeRates.length > 0 ? Math.max(...changeRates) : 5;
  const ratePadding = minRate === maxRate ? 2 : Math.max((maxRate - minRate) * 0.2, 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Market Trend</div>
          <h4 className="mt-1 text-base font-semibold text-slate-900">地価推移</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            棒は各年の地価、線は前年からの変化率です。価格水準と上昇・下落の勢いを同時に確認できます。
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <div className="text-[11px] text-slate-500">直近地価</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {latestPoint.price.toLocaleString("ja-JP")}円/m²
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{latestPoint.year}年</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
        <MetaChip label={`期間 ${chartData[0].year} - ${latestPoint.year}`} />
        <MetaChip label="棒: 円/m²" />
        <MetaChip label="線: 前年比 %" />
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
        <LegendItem color="#0d9488" label="地価" square />
        <LegendItem color="#f59e0b" label="前年比" />
      </div>

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 14, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickMargin={8}
            />
            <YAxis
              yAxisId="price"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickFormatter={(v: number) => `${formatPrice(v)}`}
              width={70}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              tick={{ fontSize: 10, fill: "#f59e0b" }}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              width={56}
              domain={[minRate - ratePadding, maxRate + ratePadding]}
            />
            <Tooltip content={<LandPriceTooltip />} />
            <Bar
              yAxisId="price"
              dataKey="price"
              fill="#0d9488"
              fillOpacity={0.8}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="rate"
              dataKey="changeRate"
              type="monotone"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#f59e0b", stroke: "#ffffff", strokeWidth: 1.5 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LandPriceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg shadow-slate-200/60">
      <div className="mb-2 font-semibold text-slate-900">{label}年</div>
      <div className="space-y-1.5">
        <TooltipRow color="#0d9488" label="地価" value={`${point.price.toLocaleString("ja-JP")}円/m²`} />
        {point.changeRate !== null ? (
          <TooltipRow color="#f59e0b" label="前年比" value={`${point.changeRate.toFixed(1)}%`} />
        ) : (
          <TooltipRow color="#cbd5e1" label="前年比" value="初年度のためなし" />
        )}
      </div>
    </div>
  );
}


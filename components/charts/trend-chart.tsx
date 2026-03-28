"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
} from "recharts";
import { MetaChip, TooltipRow, LegendItem } from "./chart-primitives";

interface DataPoint {
  date: string;
  mean: number;
  min?: number;
  max?: number;
}

interface TrendChartProps {
  title: string;
  data: DataPoint[];
  unit: string;
  color?: string;
  subtitle?: string;
}

const TERRA_COLORS = {
  primary: "#0d9488",
};

interface ChartDataPoint extends DataPoint {
  range?: number;
}

export function TrendChart({ title, data, unit, color = TERRA_COLORS.primary, subtitle }: TrendChartProps) {
  if (data.length === 0) return null;

  const chartData: ChartDataPoint[] = data.map((point) => {
    const hasRange = point.min !== undefined && point.max !== undefined;
    return {
      ...point,
      range: hasRange ? Math.max((point.max as number) - (point.min as number), 0) : undefined,
    };
  });

  const hasMinMax = chartData.some((d) => d.min !== undefined && d.max !== undefined && d.range !== undefined);
  const latestPoint = chartData[chartData.length - 1];
  const numericValues = chartData.flatMap((point) => [point.mean, point.min, point.max]).filter(isFiniteNumber);
  const minValue = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const maxValue = numericValues.length > 0 ? Math.max(...numericValues) : 0;
  const padding = minValue === maxValue
    ? Math.max(Math.abs(minValue) * 0.1, unit ? 1 : 0.05)
    : (maxValue - minValue) * 0.12;
  const yDomain: [number, number] = [minValue - padding, maxValue + padding];
  const metaDescription = subtitle ?? (hasMinMax ? "線は平均、帯は取得範囲の最小値から最大値です。" : "月ごとの平均値の推移を示しています。");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Monthly Trend</div>
          <h4 className="mt-1 text-base font-semibold text-slate-900">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">{metaDescription}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <div className="text-[11px] text-slate-500">直近値</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {formatValue(latestPoint.mean, unit)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{formatTooltipDate(latestPoint.date)}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
        <MetaChip label={`期間 ${formatPeriod(chartData)}`} />
        <MetaChip label={`単位 ${unit || "指数"}`} />
        <MetaChip label={`データ点 ${chartData.length}`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
        <LegendItem color={color} label="平均" />
        {hasMinMax ? <LegendItem color={color} label="最小〜最大" filled /> : null}
      </div>

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={280}>
          {hasMinMax ? (
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={formatAxisMonth}
                interval="preserveStartEnd"
                minTickGap={28}
                tickMargin={8}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v: number) => formatAxisValue(v, unit)}
                width={64}
                domain={yDomain}
              />
              <Tooltip content={<TrendTooltip color={color} unit={unit} />} />
              <Area
                type="monotone"
                dataKey="min"
                stackId="range"
                stroke="none"
                fill="transparent"
              />
              <Area
                type="monotone"
                dataKey="range"
                stackId="range"
                stroke="none"
                fill={color}
                fillOpacity={0.14}
              />
              <Line
                type="monotone"
                dataKey="mean"
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </ComposedChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={formatAxisMonth}
                interval="preserveStartEnd"
                minTickGap={28}
                tickMargin={8}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v: number) => formatAxisValue(v, unit)}
                width={64}
                domain={yDomain}
              />
              <Tooltip content={<TrendTooltip color={color} unit={unit} />} />
              <Line
                type="monotone"
                dataKey="mean"
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
  color,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  label?: string;
  color: string;
  unit: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg shadow-slate-200/60">
      <div className="mb-2 font-semibold text-slate-900">{formatTooltipDate(label ?? point.date)}</div>
      <div className="space-y-1.5">
        <TooltipRow color={color} label="平均" value={formatValue(point.mean, unit)} />
        {point.min !== undefined ? (
          <TooltipRow color="#94a3b8" label="最小" value={formatValue(point.min, unit)} />
        ) : null}
        {point.max !== undefined ? (
          <TooltipRow color="#64748b" label="最大" value={formatValue(point.max, unit)} />
        ) : null}
      </div>
    </div>
  );
}


function formatAxisMonth(value: string): string {
  return value.slice(0, 7).replace("-", "/");
}

function formatTooltipDate(value: string): string {
  const [year, month] = value.slice(0, 7).split("-");
  return `${year}年${month}月`;
}

function formatPeriod(data: ChartDataPoint[]): string {
  if (data.length === 0) return "-";
  return `${formatAxisMonth(data[0].date)} - ${formatAxisMonth(data[data.length - 1].date)}`;
}

function formatAxisValue(value: number, unit: string): string {
  return value.toLocaleString("ja-JP", { maximumFractionDigits: getFractionDigits(unit) });
}

function formatValue(value: number, unit: string): string {
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: getFractionDigits(unit) })}${unit}`;
}

function getFractionDigits(unit: string): number {
  return unit ? 1 : 3;
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

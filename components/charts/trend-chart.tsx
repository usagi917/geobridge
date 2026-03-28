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
}

const TERRA_COLORS = {
  primary: "#0d9488",
};

export function TrendChart({ title, data, unit, color = TERRA_COLORS.primary }: TrendChartProps) {
  const hasMinMax = data.some((d) => d.min !== undefined && d.max !== undefined);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h4 className="mb-4 text-sm font-semibold text-slate-900">{title}</h4>
      <ResponsiveContainer width="100%" height={240}>
        {hasMinMax ? (
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickFormatter={(v: string) => v.slice(0, 7)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickFormatter={(v: number) => `${v.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}`}
              width={50}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              formatter={(value: unknown) => [`${Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}${unit}`, ""]}
              labelFormatter={(label: unknown) => String(label)}
            />
            <Area
              type="monotone"
              dataKey="min"
              stackId="range"
              stroke="none"
              fill="transparent"
            />
            <Area
              type="monotone"
              dataKey="max"
              stackId="range"
              stroke="none"
              fill={color}
              fillOpacity={0.1}
            />
            <Line
              type="monotone"
              dataKey="mean"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        ) : (
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickFormatter={(v: string) => v.slice(0, 7)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickFormatter={(v: number) => `${v.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}`}
              width={50}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              formatter={(value: unknown) => [`${Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}${unit}`, ""]}
              labelFormatter={(label: unknown) => String(label)}
            />
            <Line
              type="monotone"
              dataKey="mean"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

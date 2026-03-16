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

interface LandPricePoint {
  year: number;
  price: number;
  address?: string;
}

interface LandPriceChartProps {
  data: LandPricePoint[];
}

function formatPrice(price: number): string {
  if (price >= 10000) {
    return `${(price / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万`;
  }
  return price.toLocaleString("ja-JP");
}

export function LandPriceChart({ data }: LandPriceChartProps) {
  // Compute year-over-year change rate
  const chartData = data.map((point, i) => {
    const prevPrice = i > 0 ? data[i - 1].price : null;
    const changeRate = prevPrice ? ((point.price - prevPrice) / prevPrice) * 100 : null;
    return {
      ...point,
      changeRate,
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h4 className="mb-4 text-sm font-semibold text-slate-900">地価推移</h4>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
          />
          <YAxis
            yAxisId="price"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickFormatter={(v: number) => `${formatPrice(v)}`}
            width={60}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            width={50}
            hide
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            formatter={(value: unknown, name: unknown) => {
              const v = Number(value);
              if (name === "price") return [`${v.toLocaleString("ja-JP")}円/m²`, "地価"];
              if (name === "changeRate") return [`${v.toFixed(1)}%`, "前年比"];
              return [v, String(name)];
            }}
          />
          <Bar
            yAxisId="price"
            dataKey="price"
            fill="#0d9488"
            fillOpacity={0.7}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="rate"
            dataKey="changeRate"
            type="monotone"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3, fill: "#f59e0b" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

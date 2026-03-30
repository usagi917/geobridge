"use client";

export function MetaChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
      {label}
    </span>
  );
}

export function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span>{label}</span>
      </div>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function LegendItem({
  color,
  label,
  square = false,
  filled = false,
}: {
  color: string;
  label: string;
  square?: boolean;
  filled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={square ? "h-2.5 w-2.5 rounded-[3px]" : "h-2.5 w-2.5 rounded-full"}
        style={{
          backgroundColor: color,
          opacity: filled ? 0.25 : 1,
          border: filled ? `1px solid ${color}` : "none",
        }}
      />
      <span>{label}</span>
    </div>
  );
}

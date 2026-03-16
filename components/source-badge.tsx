import type { Source } from "@/lib/report/schema";

interface SourceBadgeProps {
  source: Source;
}

const statusColors = {
  success: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
};

const statusLabels = {
  success: "成功",
  partial: "部分取得",
  failed: "失敗",
};

export function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${statusColors[source.status]}`}>
      <span className="font-medium">{source.name}</span>
      <span className="opacity-75">({statusLabels[source.status]})</span>
      {source.count > 1 ? (
        <span className="rounded-full bg-white/45 px-1.5 py-0.5 text-[10px] font-medium">
          {source.count}件
        </span>
      ) : null}
      <span className="opacity-50">
        {new Date(source.fetched_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

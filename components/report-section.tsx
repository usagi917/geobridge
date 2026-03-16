import type { SectionContent } from "@/lib/report/schema";

interface ReportSectionProps {
  title: string;
  content: SectionContent;
}

export function ReportSection({ title, content }: ReportSectionProps) {
  const isEmpty = content.facts.length === 0 && content.gaps.length === 0 && content.risks.length === 0;

  if (isEmpty) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-base font-semibold text-slate-900 mb-3">{title}</h3>

      {content.facts.length > 0 && (
        <div className="bg-emerald-50 rounded-lg p-3 mt-2 mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">事実</h4>
          <ul className="space-y-1">
            {content.facts.map((fact, i) => (
              <li key={i} className="text-sm text-slate-700 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-400">
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.gaps.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-3 mt-2 mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">不足データ</h4>
          <ul className="space-y-1">
            {content.gaps.map((gap, i) => (
              <li key={i} className="text-sm text-slate-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-amber-400">
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.risks.length > 0 && (
        <div className="bg-rose-50 rounded-lg p-3 mt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-700 mb-1">注意点</h4>
          <ul className="space-y-1">
            {content.risks.map((risk, i) => (
              <li key={i} className="text-sm text-slate-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-rose-400">
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

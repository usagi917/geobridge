import type { ErrorEntry } from "@/lib/report/schema";

interface ErrorSectionProps {
  errors: ErrorEntry[];
}

export function ErrorSection({ errors }: ErrorSectionProps) {
  if (errors.length === 0) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h3 className="text-base font-bold text-red-800 mb-3">
        データ取得エラー ({errors.length}件)
      </h3>
      <div className="space-y-2">
        {errors.map((error, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium text-red-700">{error.source}</span>
            <span className="text-red-600 mx-1">/</span>
            <span className="text-red-600">{error.tool}</span>
            <p className="text-red-600 text-xs mt-0.5">{error.message}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-red-500">
        エラーが発生したデータは、レポートに含まれていない場合があります。
        該当セクションは「データ未取得」と表示されます。
      </p>
    </div>
  );
}

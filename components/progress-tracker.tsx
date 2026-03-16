interface ProgressTrackerProps {
  steps: string[];
  error: string | null;
}

function getStepState(step: string, isLastStep: boolean, hasGlobalError: boolean) {
  if (step.includes("失敗")) return "failed";
  if (step.includes("完了") || step.includes("座標特定")) return "success";
  if (hasGlobalError && isLastStep) return "failed";
  return isLastStep ? "active" : "success";
}

export function ProgressTracker({ steps, error }: ProgressTrackerProps) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <h3 className="text-base font-semibold text-slate-900 mb-4">分析進捗</h3>
        <div className="space-y-4">
          {steps.map((step, i) => {
            const state = getStepState(step, i === steps.length - 1, Boolean(error));
            let dotClass: string;
            let dotIcon: string;
            if (state === "failed") {
              dotClass = "bg-red-100 text-red-600";
              dotIcon = "!";
            } else if (state === "active") {
              dotClass = "bg-slate-100 text-slate-600";
              dotIcon = "\u25CF";
            } else {
              dotClass = "bg-terra-100 text-terra-600";
              dotIcon = "\u2713";
            }
            return (
            <div key={i} className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-xs ${dotClass}`}
              >
                {dotIcon}
              </div>
              <span className="text-sm text-slate-700">{step}</span>
            </div>
            );
          })}
          {!error && (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-terra-100 border-t-terra-600" />
              <span className="text-sm text-slate-500">処理中...</span>
            </div>
          )}
        </div>
        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

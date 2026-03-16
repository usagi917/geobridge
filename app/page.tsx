"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InputForm } from "@/components/input-form";
import { ProgressTracker } from "@/components/progress-tracker";

function mergeProgressSteps(current: string[], incoming: string[]): string[] {
  const merged = [...current];
  for (const step of incoming) {
    if (!merged.includes(step)) {
      merged.push(step);
    }
  }
  return merged;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function HomePage() {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: {
    address: string;
    latitude?: number;
    longitude?: number;
    perspective: string;
  }) {
    setIsAnalyzing(true);
    setError(null);
    setProgress(["分析を開始しています..."]);

    try {
      // Step 1: Geocode if needed
      let lat = data.latitude;
      let lon = data.longitude;

      if (!lat || !lon) {
        setProgress(prev => [...prev, "住所をジオコーディング中..."]);
        const geocodeRes = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: data.address }),
        });
        if (!geocodeRes.ok) {
          const err = await geocodeRes.json();
          throw new Error(err.error || "ジオコーディングに失敗しました");
        }
        const geocodeData = await geocodeRes.json();
        lat = geocodeData.latitude;
        lon = geocodeData.longitude;
        setProgress(prev => [...prev, `座標特定: ${lat?.toFixed(4)}, ${lon?.toFixed(4)}`]);
      }

      // Step 2: Create analysis job
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: data.address,
          latitude: lat,
          longitude: lon,
          perspective: data.perspective,
        }),
      });

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => null);
        throw new Error(err?.error || "分析リクエストに失敗しました");
      }

      const analyzeData = await analyzeRes.json() as {
        jobId: string;
        status: "queued" | "running" | "completed" | "failed";
        progress: string[];
      };

      setProgress((prev) => mergeProgressSteps(prev, analyzeData.progress));

      // Step 3: Poll job status (max ~5 minutes at 1.5s intervals)
      const MAX_POLL_COUNT = 200;
      for (let pollCount = 0; pollCount < MAX_POLL_COUNT; pollCount++) {
        await delay(1500);

        const statusRes = await fetch(`/api/analyze/${analyzeData.jobId}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!statusRes.ok) {
          const err = await statusRes.json().catch(() => null);
          throw new Error(err?.error || "分析ジョブの状態取得に失敗しました");
        }

        const job = await statusRes.json() as {
          status: "queued" | "running" | "completed" | "failed";
          progress: string[];
          report_id?: string;
          error_message?: string;
        };

        setProgress((prev) => mergeProgressSteps(prev, job.progress));

        if (job.status === "completed" && job.report_id) {
          setIsAnalyzing(false);
          router.push(`/report/${job.report_id}`);
          return;
        }

        if (job.status === "failed") {
          throw new Error(job.error_message || "分析中にエラーが発生しました");
        }
      }
      throw new Error("分析がタイムアウトしました。時間をおいて再度お試しください");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900">候補地の居住環境を診断</h2>
        <p className="text-base text-slate-500">
          住所を入力すると、衛星データと行政データを統合したレポートを生成します
        </p>
      </div>

      {!isAnalyzing ? (
        <InputForm onSubmit={handleSubmit} />
      ) : (
        <ProgressTracker steps={progress} error={error} />
      )}

      {error && !isAnalyzing && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

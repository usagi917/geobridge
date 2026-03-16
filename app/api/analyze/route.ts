import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import { createAnalysisJob } from "@/lib/db";
import { enqueueAnalysisJob } from "@/lib/analysis/job-runner";
import { reportInputSchema } from "@/lib/report/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = reportInputSchema.parse({
      address: body.address,
      latitude: body.latitude,
      longitude: body.longitude,
      radius_m: body.radius_m || CONFIG.report.defaultRadius,
      perspective: body.perspective || "comprehensive",
    });

    const job = createAnalysisJob(input);
    enqueueAnalysisJob(job.id);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "分析中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

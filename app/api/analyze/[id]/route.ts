import { NextResponse } from "next/server";
import { getAnalysisJob } from "@/lib/db";
import { ensureAnalysisJobScheduled } from "@/lib/analysis/job-runner";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  ensureAnalysisJobScheduled(id);

  const job = getAnalysisJob(id);
  if (!job) {
    return NextResponse.json(
      { error: "分析ジョブが見つかりません" },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}

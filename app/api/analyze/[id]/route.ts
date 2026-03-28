import { NextResponse } from "next/server";
import { getAnalysisJob } from "@/lib/db";
import { ensureAnalysisJobScheduled } from "@/lib/analysis/job-runner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "無効なジョブIDです" },
      { status: 400 }
    );
  }

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

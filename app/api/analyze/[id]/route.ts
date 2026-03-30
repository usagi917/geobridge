import { NextResponse } from "next/server";
import { getAnalysisJob } from "@/lib/db";
import { ensureAnalysisJobScheduled } from "@/lib/analysis/job-runner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "無効なジョブIDです" },
        { status: 400 }
      );
    }

    const job = getAnalysisJob(id);
    if (!job) {
      return NextResponse.json(
        { error: "分析ジョブが見つかりません" },
        { status: 404 }
      );
    }

    ensureAnalysisJobScheduled(id);

    const updatedJob = getAnalysisJob(id) ?? job;
    return NextResponse.json(updatedJob);
  } catch (error) {
    console.error("[api/analyze] Error:", error);
    return NextResponse.json(
      { error: "分析ジョブの取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

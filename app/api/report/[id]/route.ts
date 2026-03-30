import { NextResponse } from "next/server";
import { getReport } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "無効なレポートIDです" },
      { status: 400 }
    );
  }

  const report = getReport(id);

  if (!report) {
    return NextResponse.json(
      { error: "レポートが見つかりません" },
      { status: 404 }
    );
  }

  return NextResponse.json(report);
}

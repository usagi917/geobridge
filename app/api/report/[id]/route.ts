import { NextResponse } from "next/server";
import { getReport } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = getReport(id);

  if (!report) {
    return NextResponse.json(
      { error: "レポートが見つかりません" },
      { status: 404 }
    );
  }

  return NextResponse.json(report);
}

import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "住所を入力してください" },
        { status: 400 }
      );
    }

    const result = await geocodeAddress(address);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ジオコーディングに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

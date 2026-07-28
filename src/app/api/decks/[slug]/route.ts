import { NextResponse } from "next/server";

import { getDeck } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const deck = await getDeck(slug);

  if (!deck) {
    return NextResponse.json({ message: "Không tìm thấy bộ từ." }, { status: 404 });
  }

  return NextResponse.json({ deck });
}

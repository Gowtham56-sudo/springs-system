import { NextRequest, NextResponse } from "next/server";
import { connectMongo, getPublicWedding } from "backend";

interface RouteParams {
  params: Promise<{ weddingCode: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await connectMongo();
    const { weddingCode } = await params;
    const wedding = await getPublicWedding(weddingCode);

    if (!wedding) {
      return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
    }

    return NextResponse.json(wedding);
  } catch (error) {
    console.error("Get wedding error:", error);
    return NextResponse.json(
      { error: "Failed to get wedding" },
      { status: 500 }
    );
  }
}

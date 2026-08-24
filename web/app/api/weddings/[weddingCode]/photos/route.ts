import { NextRequest, NextResponse } from "next/server";
import { connectMongo, getPhotosPaginated } from "backend";

interface RouteParams {
  params: Promise<{ weddingCode: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectMongo();
    const { weddingCode } = await params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const cursor = searchParams.get("cursor") || undefined;
    const since = searchParams.get("since") || undefined;

    const result = await getPhotosPaginated(weddingCode, {
      limit,
      cursor,
      since,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get photos error:", error);
    const message =
      error instanceof Error && error.message === "Wedding not found"
        ? "Wedding not found"
        : "Failed to get photos";
    const status = message === "Wedding not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

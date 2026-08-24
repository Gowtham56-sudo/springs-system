import { NextRequest, NextResponse } from "next/server";
import { downloadFileFromDrive } from "backend";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const buffer = await downloadFileFromDrive(fileId);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Internal drive download error:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  connectMongo,
  getPhotoById,
  validatePhotoBelongsToWedding,
  getFileStreamFromDrive,
} from "backend";

interface RouteParams {
  params: Promise<{ photoId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectMongo();
    const { photoId } = await params;
    const { searchParams } = new URL(request.url);
    const weddingCode = searchParams.get("weddingCode");

    let photo;

    if (weddingCode) {
      photo = await validatePhotoBelongsToWedding(photoId, weddingCode);
    } else {
      photo = await getPhotoById(photoId);
    }

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const { stream, mimeType } = await getFileStreamFromDrive(
      photo.googleDriveFileId
    );

    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err: Error) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${photo.fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Photo storage is temporarily unavailable." },
      { status: 503 }
    );
  }
}

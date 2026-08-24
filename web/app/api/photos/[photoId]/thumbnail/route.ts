import { NextRequest, NextResponse } from "next/server";
import { connectMongo, getPhotoById, getFileStreamFromDrive } from "backend";

interface RouteParams {
  params: Promise<{ photoId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await connectMongo();
    const { photoId } = await params;
    const photo = await getPhotoById(photoId);

    if (!photo || !photo.thumbnailFileId) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const { stream, mimeType } = await getFileStreamFromDrive(
      photo.thumbnailFileId
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
        "Content-Type": mimeType || "image/webp",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Thumbnail error:", error);
    return NextResponse.json(
      { error: "Failed to load thumbnail" },
      { status: 503 }
    );
  }
}

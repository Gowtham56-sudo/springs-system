import { NextRequest, NextResponse } from "next/server";
import { connectMongo, getPhotoById } from "backend";

interface RouteParams {
  params: Promise<{ photoId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await connectMongo();
    const { photoId } = await params;
    const photo = await getPhotoById(photoId);

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: photo._id!.toString(),
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      fileSize: photo.fileSize,
      processingStatus: photo.processingStatus,
      thumbnailUrl: `/api/photos/${photo._id!.toString()}/thumbnail`,
      uploadedAt: photo.uploadedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Get photo error:", error);
    return NextResponse.json(
      { error: "Failed to get photo" },
      { status: 500 }
    );
  }
}

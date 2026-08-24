import { NextRequest, NextResponse } from "next/server";
import {
  connectMongo,
  updatePhotoStatus,
  storeFaceEmbeddings,
  processPhotoFromBuffer,
  getPhotoById,
  downloadFileFromDrive,
  ObjectId,
} from "backend";

export async function POST(request: NextRequest) {
  try {
    await connectMongo();
    const body = await request.json();
    const { weddingId, photoId, googleDriveFileId } = body;

    if (!weddingId || !photoId) {
      return NextResponse.json(
        { error: "Missing weddingId or photoId" },
        { status: 400 }
      );
    }

    await updatePhotoStatus(photoId, "processing");

    const photo = await getPhotoById(photoId);
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const fileId = googleDriveFileId || photo.googleDriveFileId;
    const imageBuffer = await downloadFileFromDrive(fileId);
    const aiResult = await processPhotoFromBuffer(imageBuffer);

    const embeddings = aiResult.faces.map((face) => ({
      faceIndex: face.faceIndex,
      embedding: face.embedding,
    }));

    await storeFaceEmbeddings(
      new ObjectId(weddingId),
      new ObjectId(photoId),
      embeddings
    );

    await updatePhotoStatus(photoId, "completed");

    return NextResponse.json({
      photoId,
      facesDetected: embeddings.length,
      embeddingDimension: aiResult.embeddingDimension,
      processingStatus: "completed",
    });
  } catch (error) {
    console.error("AI process error:", error);
    return NextResponse.json(
      { error: "Face processing failed. The photo will be retried automatically." },
      { status: 503 }
    );
  }
}

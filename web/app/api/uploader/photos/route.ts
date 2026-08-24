import { NextRequest, NextResponse } from "next/server";
import {
  connectMongo,
  registerPhoto,
  updatePhotoStatus,
  storeFaceEmbeddings,
  processPhotoFromBuffer,
  validateUploaderApiKey,
  ObjectId,
} from "backend";

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-uploader-api-key");
    if (!validateUploaderApiKey(apiKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectMongo();
    const body = await request.json();

    const {
      weddingCode,
      fileName,
      fileHash,
      googleDriveFileId,
      thumbnailFileId,
      mimeType,
      fileSize,
    } = body;

    if (
      !weddingCode ||
      !fileName ||
      !fileHash ||
      !googleDriveFileId ||
      !thumbnailFileId
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { photo, duplicate } = await registerPhoto({
      weddingCode,
      fileName,
      fileHash,
      googleDriveFileId,
      thumbnailFileId,
      mimeType: mimeType || "image/jpeg",
      fileSize: fileSize || 0,
    });

    if (duplicate) {
      return NextResponse.json({
        photoId: photo._id!.toString(),
        duplicate: true,
        processingStatus: photo.processingStatus,
      });
    }

    // Trigger async AI processing
    processPhotoAsync(photo._id!.toString(), photo.weddingId.toString()).catch(
      console.error
    );

    return NextResponse.json(
      {
        photoId: photo._id!.toString(),
        duplicate: false,
        processingStatus: "uploaded",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register photo error:", error);
    return NextResponse.json(
      { error: "Failed to register photo" },
      { status: 500 }
    );
  }
}

async function processPhotoAsync(
  photoId: string,
  weddingId: string
): Promise<void> {
  const { getPhotoById, downloadFileFromDrive } = await import("backend");

  try {
    await updatePhotoStatus(photoId, "processing");

    const photo = await getPhotoById(photoId);
    if (!photo) return;

    const imageBuffer = await downloadFileFromDrive(photo.googleDriveFileId);
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
  } catch (error) {
    console.error(`AI processing failed for photo ${photoId}:`, error);
    await updatePhotoStatus(photoId, "failed");
  }
}

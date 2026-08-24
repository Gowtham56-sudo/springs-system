import { ObjectId } from "mongodb";
import { nanoid } from "nanoid";
import {
  getWeddingsCollection,
  getPhotosCollection,
  getFaceEmbeddingsCollection,
} from "../mongodb/client";
import type {
  Wedding,
  Photo,
  CreateWeddingInput,
  PublicWedding,
  PublicPhoto,
  VectorSearchResult,
  SearchMatchResult,
  RegisterPhotoInput,
} from "../types";
import { createWeddingDriveFolders } from "../google-drive/client";

function generateWeddingCode(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `WDG-${year}-${suffix}`;
}

export async function createWedding(
  input: CreateWeddingInput
): Promise<Wedding> {
  const collection = await getWeddingsCollection();
  const weddingCode = generateWeddingCode();
  const qrToken = nanoid(32);

  const driveFolders = await createWeddingDriveFolders(weddingCode);

  const wedding: Wedding = {
    weddingCode,
    brideName: input.brideName,
    groomName: input.groomName,
    eventDate: input.eventDate,
    venue: input.venue,
    googleDriveFolderId: driveFolders.rootFolderId,
    qrToken,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(wedding);
  wedding._id = result.insertedId;
  return wedding;
}

export async function getWeddingByCode(
  weddingCode: string
): Promise<Wedding | null> {
  const collection = await getWeddingsCollection();
  return collection.findOne({ weddingCode, status: "active" });
}

export async function getPublicWedding(
  weddingCode: string
): Promise<PublicWedding | null> {
  const wedding = await getWeddingByCode(weddingCode);
  if (!wedding) return null;

  const photos = await getPhotosCollection();
  const photoCount = await photos.countDocuments({
    weddingId: wedding._id,
    processingStatus: "completed",
  });

  return {
    weddingCode: wedding.weddingCode,
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    eventDate: wedding.eventDate,
    venue: wedding.venue,
    status: wedding.status,
    photoCount,
  };
}

export async function getPhotosPaginated(
  weddingCode: string,
  options: { limit?: number; cursor?: string; since?: string }
): Promise<{ photos: PublicPhoto[]; nextCursor: string | null; total: number }> {
  const wedding = await getWeddingByCode(weddingCode);
  if (!wedding) {
    throw new Error("Wedding not found");
  }

  const limit = Math.min(options.limit || 30, 50);
  const photos = await getPhotosCollection();

  const filter: Record<string, unknown> = {
    weddingId: wedding._id,
    processingStatus: "completed",
  };

  if (options.since) {
    filter.uploadedAt = { $gt: new Date(options.since) };
  }

  if (options.cursor) {
    filter._id = { $lt: new ObjectId(options.cursor) };
  }

  const total = await photos.countDocuments({
    weddingId: wedding._id,
    processingStatus: "completed",
  });

  const docs = await photos
    .find(filter)
    .sort({ uploadedAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;

  const publicPhotos: PublicPhoto[] = items.map((p) => ({
    id: p._id!.toString(),
    fileName: p.fileName,
    thumbnailUrl: `/api/photos/${p._id!.toString()}/thumbnail`,
    uploadedAt: p.uploadedAt?.toISOString(),
  }));

  const nextCursor =
    hasMore && items.length > 0
      ? items[items.length - 1]._id!.toString()
      : null;

  return { photos: publicPhotos, nextCursor, total };
}

export async function registerPhoto(
  input: RegisterPhotoInput
): Promise<{ photo: Photo; duplicate: boolean }> {
  const wedding = await getWeddingByCode(input.weddingCode);
  if (!wedding) {
    throw new Error("Wedding not found");
  }

  const photos = await getPhotosCollection();

  const existing = await photos.findOne({
    weddingId: wedding._id,
    fileHash: input.fileHash,
  });

  if (existing) {
    return { photo: existing, duplicate: true };
  }

  const photo: Photo = {
    weddingId: wedding._id!,
    fileName: input.fileName,
    fileHash: input.fileHash,
    googleDriveFileId: input.googleDriveFileId,
    thumbnailFileId: input.thumbnailFileId,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    processingStatus: "uploaded",
    uploadedAt: new Date(),
    createdAt: new Date(),
  };

  const result = await photos.insertOne(photo);
  photo._id = result.insertedId;
  return { photo, duplicate: false };
}

export async function updatePhotoStatus(
  photoId: string,
  status: Photo["processingStatus"]
): Promise<void> {
  const photos = await getPhotosCollection();
  await photos.updateOne(
    { _id: new ObjectId(photoId) },
    { $set: { processingStatus: status } }
  );
}

export async function getPhotoById(photoId: string): Promise<Photo | null> {
  const photos = await getPhotosCollection();
  return photos.findOne({ _id: new ObjectId(photoId) });
}

export async function storeFaceEmbeddings(
  weddingId: ObjectId,
  photoId: ObjectId,
  embeddings: { faceIndex: number; embedding: number[] }[]
): Promise<void> {
  const collection = await getFaceEmbeddingsCollection();

  await collection.deleteMany({ photoId });

  if (embeddings.length === 0) return;

  const docs = embeddings.map((e) => ({
    weddingId,
    photoId,
    faceIndex: e.faceIndex,
    embedding: e.embedding,
    createdAt: new Date(),
  }));

  await collection.insertMany(docs);
}

export async function vectorSearchFaces(
  weddingId: ObjectId,
  queryEmbedding: number[],
  threshold: number,
  limit: number = 100
): Promise<VectorSearchResult[]> {
  const collection = await getFaceEmbeddingsCollection();
  const db = collection.db;

  try {
    const results = await collection
      .aggregate<{
        photoId: ObjectId;
        score: number;
      }>([
        {
          $vectorSearch: {
            index: "face_embedding_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: limit * 10,
            limit: limit * 3,
            filter: {
              weddingId: weddingId,
            },
          },
        },
        {
          $project: {
            photoId: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
        {
          $match: {
            score: { $gte: threshold },
          },
        },
      ])
      .toArray();

    if (results.length === 0) {
      // It's possible the index doesn't exist and MongoDB silently returned []
      // Let's try the fallback search just in case.
      const fallbackResults = await fallbackVectorSearch(weddingId, queryEmbedding, threshold, limit);
      if (fallbackResults.length > 0) {
        console.warn("Vector search returned 0 results, but fallback found matches. Your Atlas Vector Search index might be missing or building.");
        return fallbackResults;
      }
    }

    return results;
  } catch (error) {
    // Fallback for local dev without Atlas Vector Search index
    console.warn(
      "Vector search index not available, using in-memory fallback:",
      error
    );
    return fallbackVectorSearch(weddingId, queryEmbedding, threshold, limit);
  }
}

async function fallbackVectorSearch(
  weddingId: ObjectId,
  queryEmbedding: number[],
  threshold: number,
  limit: number
): Promise<VectorSearchResult[]> {
  const collection = await getFaceEmbeddingsCollection();
  const allEmbeddings = await collection.find({ weddingId }).toArray();

  const scored = allEmbeddings.map((doc) => ({
    photoId: doc.photoId,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.filter((s) => s.score >= threshold).slice(0, limit * 3);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function searchMatchingPhotos(
  weddingCode: string,
  queryEmbedding: number[]
): Promise<SearchMatchResult[]> {
  const wedding = await getWeddingByCode(weddingCode);
  if (!wedding) {
    throw new Error("Wedding not found");
  }

  const threshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.4");
  const results = await vectorSearchFaces(
    wedding._id!,
    queryEmbedding,
    threshold
  );

  const seen = new Set<string>();
  const matches: SearchMatchResult[] = [];

  const photos = await getPhotosCollection();

  for (const result of results) {
    const photoIdStr = result.photoId.toString();
    if (seen.has(photoIdStr)) continue;
    seen.add(photoIdStr);

    const photo = await photos.findOne({ _id: result.photoId });
    if (!photo || photo.processingStatus !== "completed") continue;

    matches.push({
      photoId: photoIdStr,
      fileName: photo.fileName,
      thumbnailUrl: `/api/photos/${photoIdStr}/thumbnail`,
      score: result.score,
    });
  }

  // Sort matches by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

export async function validatePhotoBelongsToWedding(
  photoId: string,
  weddingCode: string
): Promise<Photo | null> {
  const wedding = await getWeddingByCode(weddingCode);
  if (!wedding) return null;

  const photo = await getPhotoById(photoId);
  if (!photo) return null;

  if (!photo.weddingId.equals(wedding._id!)) return null;
  return photo;
}

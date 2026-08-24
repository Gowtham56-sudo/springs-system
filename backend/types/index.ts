import { ObjectId } from "mongodb";

export type WeddingStatus = "active" | "inactive" | "archived";

export interface Wedding {
  _id?: ObjectId;
  weddingCode: string;
  brideName: string;
  groomName: string;
  eventDate: string;
  venue: string;
  googleDriveFolderId: string;
  qrToken: string;
  status: WeddingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ProcessingStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "processing"
  | "completed"
  | "failed";

export interface Photo {
  _id?: ObjectId;
  weddingId: ObjectId;
  fileName: string;
  fileHash: string;
  googleDriveFileId: string;
  thumbnailFileId: string;
  mimeType: string;
  fileSize: number;
  processingStatus: ProcessingStatus;
  uploadedAt?: Date;
  createdAt: Date;
}

export interface FaceEmbedding {
  _id?: ObjectId;
  weddingId: ObjectId;
  photoId: ObjectId;
  faceIndex: number;
  embedding: number[];
  createdAt: Date;
}

export interface VectorSearchResult {
  photoId: ObjectId;
  score: number;
}

export interface PublicWedding {
  weddingCode: string;
  brideName: string;
  groomName: string;
  eventDate: string;
  venue: string;
  status: WeddingStatus;
  photoCount: number;
}

export interface PublicPhoto {
  id: string;
  fileName: string;
  thumbnailUrl: string;
  uploadedAt?: string;
}

export interface SearchMatchResult {
  photoId: string;
  fileName: string;
  thumbnailUrl: string;
  score: number;
}

export interface CreateWeddingInput {
  brideName: string;
  groomName: string;
  eventDate: string;
  venue: string;
}

export interface RegisterPhotoInput {
  weddingCode: string;
  fileName: string;
  fileHash: string;
  googleDriveFileId: string;
  thumbnailFileId: string;
  mimeType: string;
  fileSize: number;
}

export interface ProcessPhotoInput {
  weddingId: string;
  photoId: string;
  googleDriveFileId: string;
}

export interface FaceDetectionResult {
  faceIndex: number;
  embedding: number[];
  detScore: number;
  bbox: number[];
}

export interface AIProcessResponse {
  faces: FaceDetectionResult[];
  embeddingDimension: number;
}

export interface AISelfieResponse {
  embedding: number[];
  embeddingDimension: number;
  detScore: number;
}

export interface AISelfieError {
  error: string;
  code: "NO_FACE" | "MULTIPLE_FACES" | "LOW_QUALITY" | "INVALID_IMAGE";
}

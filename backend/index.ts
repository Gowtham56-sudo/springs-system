export * from "./types";
export { connectMongo, getDb, closeMongo, ObjectId, getWeddingsCollection } from "./mongodb/client";
export {
  createWedding,
  getWeddingByCode,
  getPublicWedding,
  getPhotosPaginated,
  registerPhoto,
  updatePhotoStatus,
  getPhotoById,
  storeFaceEmbeddings,
  vectorSearchFaces,
  searchMatchingPhotos,
  validatePhotoBelongsToWedding,
} from "./services/wedding-service";
export {
  getDriveClient,
  createWeddingDriveFolders,
  getWeddingDriveFolders,
  uploadFileToDrive,
  downloadFileFromDrive,
  getFileStreamFromDrive,
  checkDriveConnection,
} from "./google-drive/client";
export {
  validateImageMimeType,
  validateSelfieSize,
  validatePhotoSize,
  generateThumbnail,
  validateImageBuffer,
  checkRateLimit,
  validateUploaderApiKey,
  getClientIp,
} from "./security/validation";
export {
  processPhotoFaces,
  processSelfie,
  processPhotoFromBuffer,
  checkAIServiceHealth,
} from "./services/ai-client";

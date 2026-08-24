import sharp from "sharp";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const MAX_SELFIE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PHOTO_SIZE = 50 * 1024 * 1024; // 50MB

export function validateImageMimeType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType.toLowerCase());
}

export function validateSelfieSize(size: number): boolean {
  return size > 0 && size <= MAX_SELFIE_SIZE;
}

export function validatePhotoSize(size: number): boolean {
  return size > 0 && size <= MAX_PHOTO_SIZE;
}

export async function generateThumbnail(
  imageBuffer: Buffer,
  maxWidth: number = 800
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(maxWidth, maxWidth, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function validateImageBuffer(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return !!(metadata.width && metadata.height && metadata.width > 0);
  } catch {
    return false;
  }
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 60_000
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}

export function validateUploaderApiKey(apiKey: string | null): boolean {
  const expected = process.env.UPLOADER_API_KEY;
  if (!expected) return false;
  return apiKey === expected;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001";

import type {
  AIProcessResponse,
  AISelfieResponse,
  AISelfieError,
} from "../types";

export async function processPhotoFaces(
  googleDriveFileId: string,
  weddingId: string,
  photoId: string
): Promise<AIProcessResponse> {
  const response = await fetch(`${AI_SERVICE_URL}/api/ai/process`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Bypass-Tunnel-Reminder": "true",
      "ngrok-skip-browser-warning": "true"
    },
    body: JSON.stringify({
      googleDriveFileId,
      weddingId,
      photoId,
      downloadUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/internal/drive/${googleDriveFileId}`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI processing failed: ${text}`);
  }

  return response.json() as Promise<AIProcessResponse>;
}

export async function processSelfie(
  imageBuffer: Buffer,
  mimeType: string
): Promise<AISelfieResponse | AISelfieError> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  formData.append("selfie", blob, "selfie.jpg");

  const response = await fetch(`${AI_SERVICE_URL}/api/ai/selfie`, {
    method: "POST",
    headers: {
      "Bypass-Tunnel-Reminder": "true",
      "ngrok-skip-browser-warning": "true"
    },
    body: formData,
  });

  const data = (await response.json()) as any;

  if (!response.ok) {
    const error = data.detail || data;
    return error as AISelfieError;
  }

  return data as AISelfieResponse;
}

export async function processPhotoFromBuffer(
  imageBuffer: Buffer
): Promise<AIProcessResponse> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
  formData.append("photo", blob, "photo.jpg");

  const response = await fetch(`${AI_SERVICE_URL}/api/ai/process-upload`, {
    method: "POST",
    headers: {
      "Bypass-Tunnel-Reminder": "true",
      "ngrok-skip-browser-warning": "true"
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI processing failed: ${text}`);
  }

  return response.json() as Promise<AIProcessResponse>;
}

export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/health`, {
      headers: {
        "Bypass-Tunnel-Reminder": "true",
        "ngrok-skip-browser-warning": "true"
      },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

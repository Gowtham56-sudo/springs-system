export interface PublicWedding {
  weddingCode: string;
  brideName: string;
  groomName: string;
  eventDate: string;
  venue: string;
  status: string;
  photoCount: number;
}

export interface PublicPhoto {
  id: string;
  fileName: string;
  thumbnailUrl: string;
  uploadedAt?: string;
}

export interface SearchMatch {
  photoId: string;
  fileName: string;
  thumbnailUrl: string;
  score: number;
}

export interface PhotosResponse {
  photos: PublicPhoto[];
  nextCursor: string | null;
  total: number;
}

export interface SearchResponse {
  matches: SearchMatch[];
  count: number;
}

export async function fetchWedding(weddingCode: string): Promise<PublicWedding> {
  const res = await fetch(`/api/weddings/${weddingCode}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Wedding not found");
  return res.json();
}

export async function fetchPhotos(
  weddingCode: string,
  cursor?: string,
  since?: string
): Promise<PhotosResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (since) params.set("since", since);
  params.set("limit", "30");

  const res = await fetch(
    `/api/weddings/${weddingCode}/photos?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load photos");
  return res.json();
}

export async function searchPhotos(
  weddingCode: string,
  selfie: File
): Promise<SearchResponse> {
  const formData = new FormData();
  formData.append("selfie", selfie);

  const res = await fetch(`/api/weddings/${weddingCode}/search`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Search failed");
  }
  return data;
}

export function formatWeddingDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatCoupleName(bride: string, groom: string): string {
  return `${groom.toUpperCase()} ❤️ ${bride.toUpperCase()}`;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WeddingHeader, { FindPhotosButton } from "@/components/WeddingHeader";
import PhotoGrid from "@/components/PhotoGrid";
import {
  fetchWedding,
  fetchPhotos,
  type PublicWedding,
  type PublicPhoto,
} from "@/lib/api";

interface WeddingGalleryProps {
  weddingCode: string;
}

export default function WeddingGallery({ weddingCode }: WeddingGalleryProps) {
  const [wedding, setWedding] = useState<PublicWedding | null>(null);
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPhotoCount, setNewPhotoCount] = useState(0);
  const lastPollRef = useRef<string>(new Date().toISOString());

  const loadWedding = useCallback(async () => {
    try {
      const data = await fetchWedding(weddingCode);
      setWedding(data);
    } catch {
      setError("Wedding not found");
    }
  }, [weddingCode]);

  const loadPhotos = useCallback(
    async (append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const data = await fetchPhotos(
          weddingCode,
          append ? cursor || undefined : undefined
        );

        setPhotos((prev) => (append ? [...prev, ...data.photos] : data.photos));
        setCursor(data.nextCursor);
      } catch {
        if (!append) setError("Failed to load photos");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [weddingCode, cursor]
  );

  useEffect(() => {
    loadWedding();
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingCode]);

  // Poll for new photos every 20 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await fetchPhotos(weddingCode, undefined, lastPollRef.current);
        if (data.photos.length > 0) {
          setNewPhotoCount(data.photos.length);
        }
        // Refresh wedding count
        const w = await fetchWedding(weddingCode);
        setWedding(w);
      } catch {
        // silent
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [weddingCode]);

  const handleViewNewPhotos = async () => {
    lastPollRef.current = new Date().toISOString();
    setNewPhotoCount(0);
    await loadWedding();
    await loadPhotos(false);
  };

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-2xl font-serif text-charcoal mb-2">{error}</p>
          <p className="text-charcoal/60">Please check your QR code and try again.</p>
        </div>
      </main>
    );
  }

  if (!wedding) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-8">
      <WeddingHeader
        brideName={wedding.brideName}
        groomName={wedding.groomName}
        eventDate={wedding.eventDate}
        venue={wedding.venue}
        photoCount={wedding.photoCount}
      />

      <div className="px-6 mb-8">
        <FindPhotosButton weddingCode={weddingCode} />
      </div>

      {newPhotoCount > 0 && (
        <div className="mx-4 mb-6 p-4 bg-gold/10 border border-gold/30 rounded-xl text-center animate-fade-in">
          <p className="text-charcoal mb-2">
            {newPhotoCount} new photo{newPhotoCount > 1 ? "s" : ""} available
          </p>
          <button
            onClick={handleViewNewPhotos}
            className="gradient-gold text-white px-6 py-2 rounded-full text-sm font-medium"
          >
            View New Photos
          </button>
        </div>
      )}

      <section>
        <h2 className="font-serif text-xl text-center text-charcoal/70 mb-6">
          Latest Photos
        </h2>
        <PhotoGrid
          photos={photos}
          weddingCode={weddingCode}
          onLoadMore={() => loadPhotos(true)}
          hasMore={!!cursor}
          loading={loading || loadingMore}
        />
      </section>

      <footer className="text-center py-8 text-xs text-charcoal/40 px-6">
        <p>Your photos are processed securely with AI face recognition.</p>
        <p className="mt-1">Selfies are not stored permanently.</p>
      </footer>
    </main>
  );
}

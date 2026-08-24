"use client";

import { useState } from "react";
import type { PublicPhoto } from "@/lib/api";

interface PhotoGridProps {
  photos: PublicPhoto[];
  weddingCode: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export default function PhotoGrid({
  photos,
  weddingCode,
  onLoadMore,
  hasMore,
  loading,
}: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PublicPhoto | null>(null);

  if (photos.length === 0 && !loading) {
    return (
      <div className="text-center py-16 text-charcoal/50">
        <p className="text-lg">Photos coming soon...</p>
        <p className="text-sm mt-2">Check back shortly as new photos are uploaded</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-4 pb-8">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setSelectedPhoto(photo)}
            className="aspect-square rounded-xl overflow-hidden card-shadow hover:scale-[1.02] transition-transform animate-fade-in"
            style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumbnailUrl}
              alt={photo.fileName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="aspect-square rounded-xl skeleton"
            />
          ))}
      </div>

      {hasMore && onLoadMore && (
        <div className="text-center pb-12">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-8 py-3 border-2 border-gold text-gold rounded-full hover:bg-gold hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {selectedPhoto && (
        <PhotoLightbox
          photo={selectedPhoto}
          weddingCode={weddingCode}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </>
  );
}

function PhotoLightbox({
  photo,
  weddingCode,
  onClose,
}: {
  photo: PublicPhoto;
  weddingCode: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full bg-ivory rounded-2xl overflow-hidden card-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbnailUrl}
          alt={photo.fileName}
          className="w-full max-h-[70vh] object-contain bg-charcoal/5"
        />
        <div className="p-4 flex gap-3 justify-center">
          <a
            href={`/api/photos/${photo.id}/download?weddingCode=${weddingCode}`}
            download
            className="gradient-gold text-white px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90"
          >
            Download
          </a>
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-charcoal/20 rounded-full text-sm hover:bg-charcoal/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

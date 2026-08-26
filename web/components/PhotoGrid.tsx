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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

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
            onClick={() => setSelectedIndex(i)}
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

      {selectedPhoto && selectedIndex !== null && (
        <PhotoLightbox
          photo={selectedPhoto}
          weddingCode={weddingCode}
          onClose={() => setSelectedIndex(null)}
          onNext={selectedIndex < photos.length - 1 ? () => setSelectedIndex(selectedIndex + 1) : undefined}
          onPrev={selectedIndex > 0 ? () => setSelectedIndex(selectedIndex - 1) : undefined}
        />
      )}
    </>
  );
}

function PhotoLightbox({
  photo,
  weddingCode,
  onClose,
  onNext,
  onPrev,
}: {
  photo: PublicPhoto;
  weddingCode: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full bg-black md:bg-ivory rounded-none md:rounded-2xl overflow-hidden card-shadow flex flex-col h-full md:h-auto justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative group flex-grow flex flex-col justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbnailUrl}
            alt={photo.fileName}
            className="w-full max-h-[85vh] object-contain md:bg-charcoal/5"
          />
          {onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-black/60 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors backdrop-blur-sm"
              aria-label="Previous photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          {onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-black/60 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors backdrop-blur-sm"
              aria-label="Next photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </div>
        <div className="p-4 flex gap-3 justify-center bg-ivory">
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

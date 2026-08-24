"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import WeddingHeader from "@/components/WeddingHeader";
import PhotoGrid from "@/components/PhotoGrid";
import { searchPhotos, type SearchMatch } from "@/lib/api";

interface FindPhotosClientProps {
  weddingCode: string;
  brideName: string;
  groomName: string;
  eventDate: string;
  venue: string;
}

export default function FindPhotosClient({
  weddingCode,
  brideName,
  groomName,
  eventDate,
  venue,
}: FindPhotosClientProps) {
  const [selfie, setSelfie] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searched, setSearched] = useState(false);
  
  // Camera specific state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up camera stream when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Attach stream to video element when camera becomes active
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setPreview(null);
      setSelfie(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please allow camera permissions or use the upload option.");
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video stream
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the current video frame to the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to a blob (image file)
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera-selfie.jpg", { type: "image/jpeg" });
            setSelfie(file);
            setPreview(URL.createObjectURL(file));
            stopCamera();
          }
        }, "image/jpeg", 0.9);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelfie(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
    setSearched(false);
    setMatches([]);
    stopCamera();
  };

  const handleSearch = async () => {
    if (!selfie) {
      setError("Please upload a selfie first.");
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const result = await searchPhotos(weddingCode, selfie);
      setMatches(result.matches);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <main className="min-h-screen pb-12">
      <WeddingHeader
        brideName={brideName}
        groomName={groomName}
        eventDate={eventDate}
        venue={venue}
      />

      <div className="max-w-lg mx-auto px-6">
        {!searched ? (
          <div className="animate-fade-in">
            <h2 className="font-serif text-2xl text-center text-charcoal mb-2">
              FindPhotos
            </h2>
            <p className="text-center text-charcoal/60 mb-8 text-sm leading-relaxed">
              Take a selfie or upload one, and our AI will find photos where you appear.
            </p>

            {isCameraActive ? (
              <div className="mb-6 relative rounded-2xl overflow-hidden border-2 border-gold/40">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline
                  muted
                  className="w-full h-[400px] object-cover scale-x-[-1]" // mirror effect
                />
                <button 
                  onClick={takePhoto}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-white bg-gold flex items-center justify-center shadow-lg"
                  aria-label="Take photo"
                >
                  <span className="w-12 h-12 bg-white rounded-full opacity-80" />
                </button>
                <button 
                  onClick={stopCamera}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                >
                  ✕
                </button>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            ) : (
              <div className="flex flex-col gap-4 mb-6">
                {preview && (
                  <div className="relative mx-auto mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Selfie preview"
                      className="w-40 h-40 object-cover rounded-full ring-4 ring-gold/20"
                    />
                    <button
                      onClick={() => setPreview(null)}
                      className="absolute top-0 right-0 w-8 h-8 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center text-gray-500 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {!preview && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={startCamera}
                      className="border-2 border-dashed border-gold/40 rounded-2xl p-6 text-center cursor-pointer hover:border-gold/70 hover:bg-gold/5 transition-colors flex flex-col items-center justify-center gap-2 h-32"
                    >
                      <span className="text-3xl">📷</span>
                      <span className="text-charcoal/80 font-medium text-sm">Take Photo</span>
                    </button>

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gold/40 rounded-2xl p-6 text-center cursor-pointer hover:border-gold/70 hover:bg-gold/5 transition-colors flex flex-col items-center justify-center gap-2 h-32"
                    >
                      <span className="text-3xl">📁</span>
                      <span className="text-charcoal/80 font-medium text-sm">Upload File</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <ul className="text-xs text-charcoal/50 space-y-1.5 mb-8 px-2">
              <li>• Upload one person only</li>
              <li>• Face should be clearly visible</li>
              <li>• Avoid sunglasses and heavy blur</li>
              <li>• Good lighting works best</li>
            </ul>

            {error && (
              <div className="bg-rose/10 border border-rose/30 text-charcoal rounded-xl p-4 mb-6 text-sm text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleSearch}
              disabled={!selfie || searching || isCameraActive}
              className="w-full gradient-gold text-white py-4 rounded-full text-lg font-medium disabled:opacity-50 card-shadow transition-all"
            >
              {searching ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Searching...
                </span>
              ) : (
                "Find My Photos"
              )}
            </button>

            <p className="text-xs text-charcoal/40 text-center mt-6 leading-relaxed">
              Your selfie is used only to find matching wedding photos and is not
              stored permanently.
            </p>
          </div>
        ) : matches.length > 0 ? (
          <div className="animate-fade-in">
            <h2 className="font-serif text-2xl text-center text-charcoal mb-2">
              We found {matches.length} photo{matches.length !== 1 ? "s" : ""} of you ❤️
            </h2>
            <p className="text-center text-charcoal/60 mb-8 text-sm">
              Tap any photo to view or download
            </p>
            <PhotoGrid
              photos={matches.map((m) => ({
                id: m.photoId,
                fileName: m.fileName,
                thumbnailUrl: m.thumbnailUrl,
              }))}
              weddingCode={weddingCode}
            />
            <button
              onClick={() => {
                setSearched(false);
                setMatches([]);
                setSelfie(null);
                setPreview(null);
                setError(null);
              }}
              className="w-full mt-8 py-3 border-2 border-gold text-gold rounded-full hover:bg-gold hover:text-white transition-colors"
            >
              Try Another Selfie
            </button>
          </div>
        ) : (
          <div className="text-center py-12 animate-fade-in">
            <p className="text-lg text-charcoal mb-2">No matching photos found</p>
            <p className="text-charcoal/60 text-sm mb-6">
              We couldn&apos;t find matching photos. Try another selfie with better lighting.
            </p>
            <button
              onClick={() => {
                setSearched(false);
                setMatches([]);
                setSelfie(null);
                setPreview(null);
                setError(null);
              }}
              className="gradient-gold text-white px-8 py-3 rounded-full"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

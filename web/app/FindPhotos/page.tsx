import { getPublicWedding } from "backend";
import FindPhotosClient from "@/components/FindPhotosClient";
import { connectMongo } from "backend";

export default async function FindPhotosPage() {
  const weddingCode = "WDG-TEST-001";

  await connectMongo();
  const wedding = await getPublicWedding(weddingCode);

  if (!wedding) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-2xl font-serif">Wedding not found</p>
        </div>
      </main>
    );
  }

  return (
    <FindPhotosClient
      weddingCode={wedding.weddingCode}
      brideName={wedding.brideName}
      groomName={wedding.groomName}
      eventDate={wedding.eventDate}
      venue={wedding.venue}
    />
  );
}

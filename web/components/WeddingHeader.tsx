import Link from "next/link";

interface WeddingHeaderProps {
  brideName: string;
  groomName: string;
  eventDate: string;
  venue: string;
  photoCount?: number;
}

export default function WeddingHeader({
  brideName,
  groomName,
  eventDate,
  venue,
  photoCount,
}: WeddingHeaderProps) {
  return (
    <header className="text-center py-10 px-6 animate-fade-in max-w-2xl mx-auto">
      <p className="font-script text-gold text-4xl md:text-5xl mb-4">
        Springs Photography
      </p>
      <h1 className="font-serif text-2xl md:text-3xl text-charcoal mb-4 leading-relaxed italic">
        "Two souls with but a single thought,<br/>
        Two hearts that beat as one."
      </h1>
      <p className="text-charcoal/60 text-sm md:text-base">
        {new Date(eventDate).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
      {photoCount !== undefined && (
        <p className="mt-4 text-gold font-medium">
          {photoCount.toLocaleString()} Photos
        </p>
      )}
    </header>
  );
}

interface FindPhotosButtonProps {
  weddingCode: string;
}

export function FindPhotosButton({ weddingCode }: FindPhotosButtonProps) {
  return (
    <Link
      href={`/wedding/${weddingCode}/find`}
      className="block w-full max-w-sm mx-auto gradient-gold text-white text-center py-4 px-8 rounded-full text-lg font-medium hover:opacity-90 transition-all card-shadow animate-fade-in"
    >
      Find My Photos 🤳
    </Link>
  );
}

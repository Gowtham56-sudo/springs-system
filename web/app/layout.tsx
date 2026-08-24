import type { Metadata } from "next";
import { Great_Vibes } from "next/font/google";
import "./globals.css";

const scriptFont = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-script",
});

export const metadata: Metadata = {
  title: "Wedding Memories | AI Photo Finder",
  description: "Find your wedding photos instantly with AI face recognition",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`min-h-screen antialiased ${scriptFont.variable}`}>{children}</body>
    </html>
  );
}

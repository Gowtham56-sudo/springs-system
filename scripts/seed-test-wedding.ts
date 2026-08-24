/**
 * Seed script for test wedding WDG-TEST-001
 * Run: npx tsx scripts/seed-test-wedding.ts
 *
 * Requires MONGODB_URI in environment (loads from .env if present)
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

async function main() {
  const { connectMongo, getWeddingsCollection, createWedding } = await import(
    "../backend/index"
  );

  await connectMongo();
  const collection = await getWeddingsCollection();

  const existing = await collection.findOne({ weddingCode: "WDG-TEST-001" });
  if (existing) {
    console.log("Test wedding already exists:");
    console.log(JSON.stringify(existing, null, 2));
    process.exit(0);
  }

  // Create with fixed code by inserting directly
  const { nanoid } = await import("nanoid");
  const { createWeddingDriveFolders } = await import(
    "../backend/google-drive/client"
  );

  let driveFolders;
  try {
    driveFolders = await createWeddingDriveFolders("WDG-TEST-001");
  } catch (error) {
    console.warn(
      "Google Drive not configured - creating wedding without Drive folders."
    );
    console.warn("Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN");
    driveFolders = { rootFolderId: "pending-setup" };
  }

  const wedding = {
    weddingCode: "WDG-TEST-001",
    brideName: "Divya",
    groomName: "Arun",
    eventDate: "2026-08-15",
    venue: "ABC Mahal",
    googleDriveFolderId: driveFolders.rootFolderId,
    qrToken: nanoid(32),
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(wedding);
  console.log("Test wedding created:");
  console.log({
    _id: result.insertedId.toString(),
    ...wedding,
    qrUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/wedding/WDG-TEST-001`,
  });
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

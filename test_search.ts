import { connectMongo } from "./backend/mongodb/client";
import { searchMatchingPhotos } from "./backend/services/wedding-service";
import { config } from "dotenv";
config({ path: "./web/.env" });

async function run() {
  await connectMongo();
  
  const db = await import("./backend/mongodb/client").then(m => m.getDb());
  const face = await db.collection("face_embeddings").findOne({});
  if (!face) {
    console.log("No faces in DB");
    return;
  }
  
  console.log("Searching with embedding from photo:", face.photoId);
  try {
    const matches = await searchMatchingPhotos("WDG-TEST-001", face.embedding);
    console.log(`Found ${matches.length} matches.`);
    console.log(matches);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();

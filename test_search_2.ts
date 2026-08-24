import { connectMongo, getDb } from "./backend/mongodb/client";
import { searchMatchingPhotos } from "./backend/services/wedding-service";
import { config } from "dotenv";
config({ path: "./web/.env" });

async function run() {
  await connectMongo();
  const db = await getDb();
  
  const face = await db.collection("face_embeddings").findOne({});
  if (!face) {
    console.log("No faces in DB");
    return;
  }
  
  console.log("Found face in DB for weddingId:", face.weddingId);
  
  const wedding = await db.collection("weddings").findOne({ _id: face.weddingId });
  if (!wedding) {
    console.log("Wedding not found for ID:", face.weddingId);
    return;
  }
  
  console.log("Wedding code is:", wedding.weddingCode);
  
  console.log("Searching with threshold:", process.env.FACE_MATCH_THRESHOLD);
  
  try {
    const matches = await searchMatchingPhotos(wedding.weddingCode, face.embedding);
    console.log(`searchMatchingPhotos returned ${matches.length} matches.`);
    for (const m of matches) {
      console.log(`Match: ${m.photoId}, score: ${m.score}`);
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();

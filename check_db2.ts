import { connectMongo, getDb } from "./backend/mongodb/client";
import { config } from "dotenv";
config({ path: "./web/.env" });

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function check() {
  await connectMongo();
  const db = await getDb();
  
  const embeddings = await db.collection("face_embeddings").find({}).toArray();
  if (embeddings.length === 0) {
    console.log("No embeddings found.");
    process.exit(0);
  }
  
  const target = embeddings[0];
  console.log(`Comparing embedding ${target.faceIndex} from photo ${target.photoId} against all others:`);
  
  const threshold = 0.4;
  let matches = 0;
  for (const e of embeddings) {
    const score = cosineSimilarity(target.embedding, e.embedding);
    console.log(`- Face ${e.faceIndex} (photo: ${e.photoId}): score = ${score.toFixed(4)} (type of weddingId: ${typeof e.weddingId}, constructor: ${e.weddingId.constructor.name})`);
    if (score >= threshold) matches++;
  }
  console.log(`Found ${matches} matches above threshold ${threshold}`);
  process.exit(0);
}

check().catch(console.error);

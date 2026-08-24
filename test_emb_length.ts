import { connectMongo, getDb } from "./backend/mongodb/client";

async function run() {
  await connectMongo();
  const db = await getDb();
  
  const face = await db.collection("face_embeddings").findOne({});
  if (!face) return;
  
  console.log("DB Face Embedding length:", face.embedding.length);
  process.exit(0);
}
run();

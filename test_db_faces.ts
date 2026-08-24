import { config } from "dotenv";
config({ path: "./web/.env" });
import { connectMongo, getDb } from "./backend/mongodb/client";

async function run() {
  await connectMongo();
  const db = await getDb();
  const faces = await db.collection("face_embeddings").countDocuments();
  const photos = await db.collection("photos").countDocuments();
  console.log(`Photos: ${photos}, Faces: ${faces}`);
  process.exit(0);
}
run();

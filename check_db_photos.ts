import { config } from "dotenv";
config({ path: "./web/.env" });
import { connectMongo, getDb } from "./backend/mongodb/client";

async function run() {
  await connectMongo();
  const db = await getDb();
  
  const photos = await db.collection("photos").find({}).sort({createdAt: -1}).limit(5).toArray();
  console.log(`Latest 5 photos in the database:`);
  photos.forEach(p => console.log(`- ${p.fileName} (${p.processingStatus})`));
  process.exit(0);
}
run();

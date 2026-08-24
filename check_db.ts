import { connectMongo, getDb } from "./backend/mongodb/client";
import { config } from "dotenv";
config({ path: "./web/.env" });

async function check() {
  await connectMongo();
  const db = await getDb();
  const photos = await db.collection("photos").find({}).toArray();
  console.log("Photos in DB:");
  for (const p of photos) {
    console.log(`- Photo ID: ${p._id}, status: ${p.processingStatus}`);
  }
  process.exit(0);
}
check().catch(console.error);

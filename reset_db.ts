import { config } from "dotenv";
config({ path: "./web/.env" });
import fs from "fs";
import { connectMongo, getDb } from "./backend/mongodb/client";

async function run() {
  await connectMongo();
  const db = await getDb();
  
  await db.collection("face_embeddings").deleteMany({});
  await db.collection("photos").deleteMany({});
  
  if (fs.existsSync("./local-uploader/uploader_state.json")) {
    fs.unlinkSync("./local-uploader/uploader_state.json");
  }
  console.log("Database cleared. Ready to re-process photos with buffalo_l.");
  process.exit(0);
}
run();

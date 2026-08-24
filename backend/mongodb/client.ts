import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import type { Wedding, Photo, FaceEmbedding } from "../types";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DATABASE || "wedding_photos";

  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(database);

  await ensureIndexes(db);
  return db;
}

export async function getDb(): Promise<Db> {
  return connectMongo();
}

export async function getWeddingsCollection(): Promise<Collection<Wedding>> {
  const database = await getDb();
  return database.collection<Wedding>("weddings");
}

export async function getPhotosCollection(): Promise<Collection<Photo>> {
  const database = await getDb();
  return database.collection<Photo>("photos");
}

export async function getFaceEmbeddingsCollection(): Promise<
  Collection<FaceEmbedding>
> {
  const database = await getDb();
  return database.collection<FaceEmbedding>("face_embeddings");
}

async function ensureIndexes(database: Db): Promise<void> {
  const weddings = database.collection("weddings");
  await weddings.createIndex({ weddingCode: 1 }, { unique: true });
  await weddings.createIndex({ qrToken: 1 }, { unique: true });
  await weddings.createIndex({ status: 1 });

  const photos = database.collection("photos");
  await photos.createIndex(
    { weddingId: 1, fileHash: 1 },
    { unique: true }
  );
  await photos.createIndex({ weddingId: 1, processingStatus: 1 });
  await photos.createIndex({ weddingId: 1, uploadedAt: -1 });

  const embeddings = database.collection("face_embeddings");
  await embeddings.createIndex({ weddingId: 1, photoId: 1, faceIndex: 1 });
  await embeddings.createIndex({ photoId: 1 });
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export { ObjectId };

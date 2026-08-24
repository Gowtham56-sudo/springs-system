# MongoDB Atlas Vector Search Index Setup

Create a vector search index on the `face_embeddings` collection in MongoDB Atlas.

## Index Definition

In Atlas UI: **Database** → **Browse Collections** → `face_embeddings` → **Search Indexes** → **Create Search Index** → **JSON Editor**

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 512,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "weddingId"
    }
  ]
}
```

## Important Notes

1. **Index name must be**: `face_embedding_index` (matches code in `backend/services/wedding-service.ts`)
2. **Dimension**: 512 — this matches InsightFace `buffalo_l` ArcFace embeddings. Verify by calling `GET http://localhost:8001/health` after starting the AI service.
3. **Similarity**: cosine
4. **Filter field**: `weddingId` — ensures guest searches are scoped to one wedding only

## Verify Embedding Dimension

```bash
curl http://localhost:8001/health
# Response includes "embeddingDimension": 512
```

If your model returns a different dimension, update both the Atlas index and this documentation.

## Fallback Mode

If the vector index is not configured, the system falls back to in-memory cosine similarity search. This works for development with small datasets but is **not suitable for production** with thousands of embeddings.

## Threshold Tuning

Set `FACE_MATCH_THRESHOLD` in `.env` (default: 0.4). Tune using real wedding photos:

- Higher threshold (0.5–0.6): fewer false positives, may miss some matches
- Lower threshold (0.3–0.4): more matches, higher false positive risk

Test with the WDG-TEST-001 wedding using 50–100 photos including group shots and similar-looking guests.

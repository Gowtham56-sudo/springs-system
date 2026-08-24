# Setup Guide

## Prerequisites

- Node.js 20+
- Python 3.10+
- MongoDB Atlas cluster (M10+ recommended for Vector Search)
- Google Cloud project with Drive API enabled
- ~2 GB disk for InsightFace models (downloaded on first AI service start)

## 1. Clone and Install

```bash
# Node dependencies
npm install

# AI service
cd ai-service
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cd ..

# Local uploader
cd local-uploader
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
copy .env.example .env
```

Required variables:
- `MONGODB_URI` — Atlas connection string
- `MONGODB_DATABASE` — database name (default: wedding_photos)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
- `AI_SERVICE_URL` — http://localhost:8001
- `NEXT_PUBLIC_APP_URL` — http://localhost:3000
- `UPLOADER_API_KEY` — shared secret for local uploader

## 3. Google Drive OAuth

```bash
pip install google-auth-oauthlib python-dotenv
python scripts/setup-google-oauth.py
```

Copy the refresh token into `.env`.

## 4. MongoDB Vector Index

Follow [mongodb-vector-index.md](./mongodb-vector-index.md) to create the vector search index.

## 5. Seed Test Wedding

```bash
npm run seed
```

Creates wedding `WDG-TEST-001` (Arun ❤️ Divya).

## 6. Start Services

Open four terminals:

**Terminal 1 — Web App**
```bash
npm run dev
```

**Terminal 2 — AI Service**
```bash
cd ai-service
venv\Scripts\activate
python main.py
```

**Terminal 3 — Local Uploader**
```bash
cd local-uploader
venv\Scripts\activate
python main.py
```

**Terminal 4 — Test**
```bash
# Copy a photo to the watch folder
copy test-photo.jpg C:\WeddingPhotos\ArunDivya\
```

## 7. Test the Flow

1. Open http://localhost:3000/wedding/WDG-TEST-001
2. Download QR: http://localhost:3000/api/weddings/WDG-TEST-001/qr
3. Drop photos into `C:\WeddingPhotos\ArunDivya`
4. Watch uploader dashboard: http://localhost:8002
5. Go to Find My Photos and upload a selfie

## Local Uploader Configuration

Create `local-uploader/.env`:

```env
WATCH_FOLDER=C:\WeddingPhotos\ArunDivya
WEDDING_CODE=WDG-TEST-001
WEB_API_URL=http://localhost:3000
UPLOADER_API_KEY=your-shared-key
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| AI model download slow | First start downloads ~300MB; wait for completion |
| Drive upload fails | Verify refresh token; re-run OAuth setup |
| Vector search returns nothing | Check index name and dimension; verify embeddings exist |
| Duplicate skipped | Expected — SHA-256 hash match prevents re-upload |
| Uploader disconnected | Check internet; queue persists and auto-retries |

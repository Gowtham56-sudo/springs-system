# AI Wedding Photo Finder Platform

A production-ready MVP for AI-powered wedding photo discovery. Photographers auto-upload photos from a local folder; guests scan a QR code, upload a selfie, and receive a personalized gallery of every photo they appear in.

## Architecture

```
Photographer Camera → Local Folder → Local Uploader → Google Drive
                                                          ↓
                                                    AI Service (InsightFace)
                                                          ↓
                                                    MongoDB Atlas (Vector Search)
                                                          ↓
Guest QR Scan → Wedding Website → Selfie Upload → Vector Search → Personal Gallery → Download
```

## Features

- **Automatic folder watching** — new photos detected and uploaded without manual intervention
- **Offline-resilient queue** — SQLite-backed persistent queue with exponential backoff retry
- **SHA-256 duplicate detection** — skips already-uploaded photos
- **InsightFace face embeddings** — ArcFace 512-dim vectors stored in MongoDB
- **Wedding-scoped vector search** — guests only search within their wedding
- **Group photo support** — entire group photo returned when guest face matches
- **Privacy-first selfies** — guest selfies processed in memory, not stored
- **Secure downloads** — Google Drive credentials never exposed to browser
- **Live gallery updates** — polling every 20 seconds for new photos
- **Premium mobile-first UI** — ivory/gold wedding aesthetic

## Project Structure

```
├── web/                 Next.js guest website + API routes
├── backend/             Shared Node.js services (MongoDB, Drive, AI client)
├── ai-service/          Python FastAPI + InsightFace
├── local-uploader/      Python FastAPI folder watcher + dashboard
├── scripts/             Seed data, OAuth setup
└── docs/                Setup and vector index guides
```

## Quick Start

```bash
npm install
copy .env.example .env
# Configure .env (MongoDB, Google Drive, etc.)
npm run seed
npm run dev
```

See [docs/setup-guide.md](docs/setup-guide.md) for full setup instructions.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/weddings` | Create wedding |
| GET | `/api/weddings/:code` | Public wedding details |
| GET | `/api/weddings/:code/photos` | Paginated gallery |
| POST | `/api/weddings/:code/search` | Selfie face search |
| GET | `/api/weddings/:code/qr` | Download QR code PNG |
| GET | `/api/photos/:id/download` | Secure photo download |
| POST | `/api/uploader/photos` | Register uploaded photo (uploader) |
| POST | `/api/ai/process` | Process face embeddings |

## Test Wedding

- **Code**: `WDG-TEST-001`
- **Couple**: Arun ❤️ Divya
- **URL**: http://localhost:3000/wedding/WDG-TEST-001

## Environment Variables

See [.env.example](.env.example) for all required variables.

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Basic Next.js wedding gallery |
| 2 | ✅ | MongoDB collections + indexes |
| 3 | ✅ | Google Drive OAuth + upload |
| 4 | ✅ | Local uploader + folder watch + queue |
| 5 | ✅ | AI service (InsightFace) |
| 6 | ✅ | MongoDB Vector Search |
| 7 | ✅ | Selfie search + matching gallery |
| 8 | ✅ | QR code generation |
| 9 | ✅ | Secure photo download |
| 10 | ✅ | Live gallery polling |

## Privacy Notice

Guest selfies are used only to generate a face embedding for photo matching and are not stored permanently. Face embeddings from wedding photos are indexed for search purposes. Before commercial deployment, implement appropriate consent flows, privacy policy, and data retention controls.

## License

Private — Springs Photo System

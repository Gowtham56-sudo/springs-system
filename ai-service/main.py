"""FastAPI AI service for face detection and embedding generation."""

import logging
import os
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from face_detection.detector import (
    detect_faces,
    process_selfie,
    get_embedding_dimension,
    get_face_app,
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading InsightFace model on startup...")
    get_face_app()
    logger.info("AI service ready")
    yield


app = FastAPI(
    title="Wedding Photo AI Service",
    description="Face detection and embedding generation using InsightFace",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    googleDriveFileId: str | None = None
    weddingId: str | None = None
    photoId: str | None = None
    downloadUrl: str | None = None


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "embeddingDimension": get_embedding_dimension(),
        "model": "insightface/buffalo_s",
    }


@app.post("/api/ai/process")
async def process_photo(request: ProcessRequest):
    """Process a photo from Google Drive via download URL."""
    if not request.downloadUrl:
        raise HTTPException(status_code=400, detail="downloadUrl is required")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(request.downloadUrl)
            response.raise_for_status()
            image_bytes = response.content
    except Exception as e:
        logger.error(f"Failed to download photo: {e}")
        raise HTTPException(status_code=502, detail="Failed to download photo")

    faces = detect_faces(image_bytes)

    return {
        "faces": faces,
        "embeddingDimension": get_embedding_dimension(),
        "photoId": request.photoId,
        "weddingId": request.weddingId,
    }


@app.post("/api/ai/process-upload")
async def process_upload(photo: UploadFile = File(...)):
    """Process a photo uploaded directly (used by web API)."""
    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid image type")

    image_bytes = await photo.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    faces = detect_faces(image_bytes)

    return {
        "faces": faces,
        "embeddingDimension": get_embedding_dimension(),
    }


@app.post("/api/ai/selfie")
async def process_selfie_endpoint(selfie: UploadFile = File(...)):
    """Process a guest selfie for face matching."""
    if not selfie.content_type or not selfie.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid image", "code": "INVALID_IMAGE"},
        )

    image_bytes = await selfie.read()
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "Empty file", "code": "INVALID_IMAGE"},
        )

    result = process_selfie(image_bytes)

    if "error" in result:
        status_codes = {
            "NO_FACE": 422,
            "MULTIPLE_FACES": 422,
            "LOW_QUALITY": 422,
        }
        raise HTTPException(
            status_code=status_codes.get(result.get("code", ""), 422),
            detail=result,
        )

    return result


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

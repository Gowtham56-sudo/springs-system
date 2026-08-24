"""InsightFace-based face detection and embedding service."""

import os
import logging
from typing import Optional

import cv2
import numpy as np
from insightface.app import FaceAnalysis

logger = logging.getLogger(__name__)

# Quality thresholds (configurable via env)
MIN_DET_SCORE = float(os.getenv("FACE_MIN_DET_SCORE", "0.5"))
MIN_FACE_SIZE = int(os.getenv("FACE_MIN_SIZE", "40"))

_face_app: Optional[FaceAnalysis] = None
_embedding_dimension: Optional[int] = None


def get_face_app() -> FaceAnalysis:
    global _face_app, _embedding_dimension
    if _face_app is None:
        logger.info("Initializing InsightFace model (buffalo_s)...")
        app = FaceAnalysis(
            name="buffalo_s",
            providers=["CPUExecutionProvider"],
        )
        app.prepare(ctx_id=0, det_size=(640, 640))
        _face_app = app

        # Determine embedding dimension from model
        test_img = np.zeros((112, 112, 3), dtype=np.uint8)
        faces = app.get(test_img)
        if faces:
            _embedding_dimension = len(faces[0].embedding)
        else:
            # buffalo_l ArcFace produces 512-dim embeddings
            _embedding_dimension = 512

        logger.info(f"InsightFace ready. Embedding dimension: {_embedding_dimension}")

    return _face_app


def get_embedding_dimension() -> int:
    get_face_app()
    return _embedding_dimension or 512


def _decode_image(image_bytes: bytes) -> np.ndarray:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image data")
    return img


def _is_quality_face(face, img_shape) -> bool:
    """Evaluate face quality based on detection score and size."""
    if face.det_score < MIN_DET_SCORE:
        return False

    bbox = face.bbox
    face_width = bbox[2] - bbox[0]
    face_height = bbox[3] - bbox[1]
    face_size = min(face_width, face_height)

    if face_size < MIN_FACE_SIZE:
        return False

    return True


def detect_faces(image_bytes: bytes) -> list[dict]:
    """Detect all faces in an image and return embeddings for quality faces."""
    app = get_face_app()
    img = _decode_image(image_bytes)
    faces = app.get(img)

    results = []
    for idx, face in enumerate(faces):
        if not _is_quality_face(face, img.shape):
            continue

        embedding = face.embedding.tolist()
        # Normalize embedding
        norm = np.linalg.norm(face.embedding)
        if norm > 0:
            embedding = (face.embedding / norm).tolist()

        results.append({
            "faceIndex": idx,
            "embedding": embedding,
            "detScore": float(face.det_score),
            "bbox": face.bbox.tolist(),
        })

    return results


def process_selfie(image_bytes: bytes) -> dict:
    """Process a selfie: require exactly one quality face."""
    app = get_face_app()
    img = _decode_image(image_bytes)
    faces = app.get(img)

    quality_faces = [f for f in faces if _is_quality_face(f, img.shape)]

    if len(quality_faces) == 0:
        if len(faces) == 0:
            return {"error": "No face detected", "code": "NO_FACE"}
        return {"error": "Face quality too low", "code": "LOW_QUALITY"}

    if len(quality_faces) > 1:
        return {"error": "Multiple faces detected", "code": "MULTIPLE_FACES"}

    face = quality_faces[0]
    embedding = face.embedding
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return {
        "embedding": embedding.tolist(),
        "embeddingDimension": get_embedding_dimension(),
        "detScore": float(face.det_score),
    }

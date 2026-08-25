"""Photo processing: hash, validate, thumbnail generation."""

import hashlib
import logging
import mimetypes
import os
from io import BytesIO
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


def compute_sha256(file_path: str) -> str:
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def validate_image(file_path: str) -> bool:
    try:
        with Image.open(file_path) as img:
            img.verify()
            return img.width > 0 and img.height > 0
    except Exception as e:
        logger.warning(f"Invalid image {file_path}: {e}")
        return False


def get_mime_type(file_path: str) -> str:
    mime, _ = mimetypes.guess_type(file_path)
    return mime or "image/jpeg"


def generate_thumbnail(file_path: str, max_width: int = 800) -> bytes:
    with Image.open(file_path) as img:
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        ratio = min(max_width / img.width, max_width / img.height, 1.0)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

        buffer = BytesIO()
        img.save(buffer, format="WEBP", quality=80)
        return buffer.getvalue()


def get_thumbnail_name(original_name: str) -> str:
    stem = Path(original_name).stem
    return f"{stem}.webp"

def compress_large_image(file_path: str, max_size_mb: int = 10) -> bytes | None:
    """If file is larger than max_size_mb, compress it and return bytes. Otherwise return None."""
    file_size = os.path.getsize(file_path)
    if file_size <= max_size_mb * 1024 * 1024:
        return None
        
    logger.info(f"Compressing large image {file_path} ({file_size / 1024 / 1024:.2f}MB)")
    with Image.open(file_path) as img:
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # Resize proportionally if too large
        max_dim = 4000
        if max(img.width, img.height) > max_dim:
            ratio = max_dim / max(img.width, img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
            
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        compressed_bytes = buffer.getvalue()
        logger.info(f"Compressed size: {len(compressed_bytes) / 1024 / 1024:.2f}MB")
        return compressed_bytes

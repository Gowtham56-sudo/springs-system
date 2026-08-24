"""Background upload worker with exponential backoff retry."""

import asyncio
import logging
import math
import os
from pathlib import Path

import httpx

from google_drive.client import DriveUploader
from processor.image_processor import (
    compute_sha256,
    validate_image,
    get_mime_type,
    generate_thumbnail,
    get_thumbnail_name,
    compress_large_image,
)
from task_queue.persistent_queue import UploadQueue, QueueState

logger = logging.getLogger(__name__)

MAX_RETRIES = int(os.getenv("MAX_UPLOAD_RETRIES", "5"))
BASE_BACKOFF = float(os.getenv("BASE_BACKOFF_SECONDS", "5"))


class UploadWorker:
    def __init__(
        self,
        queue: UploadQueue,
        drive: DriveUploader,
        wedding_code: str,
        web_api_url: str,
        api_key: str,
    ):
        self.queue = queue
        self.drive = drive
        self.wedding_code = wedding_code
        self.web_api_url = web_api_url.rstrip("/")
        self.api_key = api_key
        self.watch_folder = ""
        self._running = False
        self._paused = False
        self._folders: dict | None = None

    @property
    def is_paused(self) -> bool:
        return self._paused

    def set_watch_folder(self, folder: str):
        self.watch_folder = folder
        self._folders = None

    def pause(self):
        self._paused = True

    def resume(self):
        self._paused = False

    async def _get_folders(self) -> dict | None:
        if self._folders is None:
            folder_name = Path(self.watch_folder).name if self.watch_folder else "Originals"
            self._folders = await asyncio.to_thread(self.drive.get_wedding_folders, self.wedding_code, folder_name)
        return self._folders

    def enqueue_file(self, file_path: str):
        if not validate_image(file_path):
            logger.warning(f"Skipping invalid image: {file_path}")
            return

        file_hash = compute_sha256(file_path)
        file_name = Path(file_path).name

        added = self.queue.add(file_path, file_name, file_hash)
        if added:
            logger.info(f"Queued: {file_name}")
        else:
            logger.info(f"Already in queue: {file_name}")

    async def process_one(self) -> bool:
        if self._paused:
            return False

        item = self.queue.get_next()
        if not item:
            return False

        item_id = item["id"]
        file_path = item["file_path"]
        file_name = item["file_name"]
        retry_count = item["retry_count"]

        if retry_count > 0:
            backoff = BASE_BACKOFF * math.pow(2, retry_count - 1)
            backoff = min(backoff, 300)
            logger.info(f"Retry backoff: {backoff}s for {file_name}")
            await asyncio.sleep(backoff)

        if not os.path.exists(file_path):
            self.queue.update_state(item_id, QueueState.FAILED, last_error="File not found")
            return True

        try:
            folders = await self._get_folders()
            if not folders:
                raise Exception("Google Drive wedding folders not found")

            # Upload original
            self.queue.update_state(item_id, QueueState.UPLOADING, upload_progress=0.1)
            mime_type = get_mime_type(file_path)
            file_size = os.path.getsize(file_path)

            compressed_bytes = await asyncio.to_thread(compress_large_image, file_path, 10)
            
            if compressed_bytes:
                mime_type = "image/jpeg"
                file_size = len(compressed_bytes)
                original_id = await asyncio.to_thread(
                    self.drive.upload_buffer,
                    compressed_bytes,
                    file_name,
                    mime_type,
                    folders["originalsFolderId"],
                )
            else:
                original_id = await asyncio.to_thread(
                    self.drive.upload_file,
                    file_path,
                    file_name,
                    mime_type,
                    folders["originalsFolderId"],
                )
            self.queue.update_state(item_id, QueueState.UPLOADING, upload_progress=0.6)

            # Generate and upload thumbnail
            thumb_bytes = await asyncio.to_thread(generate_thumbnail, file_path)
            thumb_name = get_thumbnail_name(file_name)
            thumb_id = await asyncio.to_thread(
                self.drive.upload_buffer,
                thumb_bytes,
                thumb_name,
                "image/webp",
                folders["thumbnailsFolderId"],
            )
            self.queue.update_state(
                item_id,
                QueueState.UPLOADING,
                upload_progress=0.9,
                google_drive_file_id=original_id,
                thumbnail_file_id=thumb_id,
            )

            # Register with web API
            file_hash = item["file_hash"] or await asyncio.to_thread(compute_sha256, file_path)
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.web_api_url}/api/uploader/photos",
                    json={
                        "weddingCode": self.wedding_code,
                        "fileName": file_name,
                        "fileHash": file_hash,
                        "googleDriveFileId": original_id,
                        "thumbnailFileId": thumb_id,
                        "mimeType": mime_type,
                        "fileSize": file_size,
                    },
                    headers={"x-uploader-api-key": self.api_key},
                )
                response.raise_for_status()
                result = response.json()

            if result.get("duplicate"):
                self.queue.update_state(
                    item_id,
                    QueueState.COMPLETED,
                    upload_progress=1.0,
                    photo_id=result.get("photoId"),
                )
                logger.info(f"Duplicate skipped: {file_name}")
            else:
                self.queue.update_state(
                    item_id,
                    QueueState.PROCESSING,
                    upload_progress=1.0,
                    photo_id=result.get("photoId"),
                )
                # Wait briefly for AI processing
                await asyncio.sleep(2)
                self.queue.update_state(item_id, QueueState.COMPLETED)

            logger.info(f"Completed: {file_name}")
            
            # Auto-Delete the original file to save PC storage
            if os.getenv("AUTO_DELETE_UPLOADED", "true").lower() == "true":
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        logger.info(f"Auto-deleted local file to save storage: {file_path}")
                except Exception as e:
                    logger.warning(f"Could not auto-delete {file_path}: {e}")

            return True

        except Exception as e:
            logger.error(f"Upload failed for {file_name}: {e}")
            
            # Reset connections to recover from stale socket or SSL errors
            self.drive.reset_connection()
            self._folders = None
            
            if retry_count >= MAX_RETRIES:
                self.queue.increment_retry(item_id, str(e), QueueState.FAILED)
            else:
                self.queue.increment_retry(item_id, str(e), QueueState.WAITING)
            return True

    async def run_loop(self):
        self._running = True
        logger.info("Upload worker started")
        while self._running:
            processed = await self.process_one()
            if not processed:
                await asyncio.sleep(2)
        logger.info("Upload worker stopped")

    def stop(self):
        self._running = False

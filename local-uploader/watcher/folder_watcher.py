"""Folder watcher using watchdog."""

import logging
import os
import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tiff", ".tif"}
STABILITY_SECONDS = float(os.getenv("FILE_STABILITY_SECONDS", "2.0"))


class PhotoHandler(FileSystemEventHandler):
    def __init__(self, on_new_photo):
        super().__init__()
        self.on_new_photo = on_new_photo
        self._pending: dict[str, float] = {}

    def _is_image(self, path: str) -> bool:
        return Path(path).suffix.lower() in IMAGE_EXTENSIONS

    def on_created(self, event):
        if event.is_directory:
            return
        if self._is_image(event.src_path):
            self._pending[event.src_path] = time.time()
            logger.info(f"Detected new file: {event.src_path}")

    def on_modified(self, event):
        if event.is_directory:
            return
        if self._is_image(event.src_path):
            self._pending[event.src_path] = time.time()

    def check_stable_files(self):
        """Check pending files and trigger callback when stable."""
        now = time.time()
        stable = []

        for path, last_modified in list(self._pending.items()):
            if not os.path.exists(path):
                del self._pending[path]
                continue

            if now - last_modified >= STABILITY_SECONDS:
                try:
                    size1 = os.path.getsize(path)
                    time.sleep(0.5)
                    size2 = os.path.getsize(path)
                    if size1 == size2 and size1 > 0:
                        stable.append(path)
                        del self._pending[path]
                except OSError:
                    del self._pending[path]

        for path in stable:
            self.on_new_photo(path)


class FolderWatcher:
    def __init__(self, folder_path: str, on_new_photo):
        self.folder_path = folder_path
        self.handler = PhotoHandler(on_new_photo)
        self.observer = Observer()

    def start(self):
        Path(self.folder_path).mkdir(parents=True, exist_ok=True)
        self.observer.schedule(self.handler, self.folder_path, recursive=True)
        self.observer.start()
        logger.info(f"Watching folder: {self.folder_path}")
        import threading
        threading.Thread(target=self.scan_existing, daemon=True).start()

    def scan_existing(self):
        """Scan the folder for existing images and enqueue them."""
        logger.info(f"Scanning existing files in {self.folder_path}")
        folder = Path(self.folder_path)
        if not folder.exists() or not folder.is_dir():
            return
            
        for child in folder.rglob('*'):
            if child.is_file() and self.handler._is_image(str(child)):
                # Enqueue existing file
                self.handler.on_new_photo(str(child))

    def stop(self):
        self.observer.stop()
        self.observer.join()

    def poll_stable(self):
        self.handler.check_stable_files()

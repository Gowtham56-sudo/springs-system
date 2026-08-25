"""Local Photo Uploader - Main application."""

import asyncio
import logging
import os
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path
import socket

# Set global socket timeout to prevent google.auth and other blocking calls from hanging forever
socket.setdefaulttimeout(30.0)

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

# Add parent dirs to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from google_drive.client import DriveUploader
from processor.upload_worker import UploadWorker
from task_queue.persistent_queue import UploadQueue
from ui.dashboard import DASHBOARD_HTML
from watcher.folder_watcher import FolderWatcher

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration
WATCH_FOLDER = os.getenv("WATCH_FOLDER", "")

if not WATCH_FOLDER:
    import tkinter as tk
    from tkinter import filedialog
    
    logger.info("Prompting user to select a watch folder...")
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    
    selected_folder = filedialog.askdirectory(title="Select the Wedding Photos Folder to Watch")
    if not selected_folder:
        logger.error("No folder selected. Exiting.")
        sys.exit(1)
        
    WATCH_FOLDER = selected_folder
WEDDING_CODE = os.getenv("WEDDING_CODE", "WDG-TEST-001")
WEB_API_URL = os.getenv("WEB_API_URL", "http://localhost:3000")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8001")
UPLOADER_API_KEY = os.getenv("UPLOADER_API_KEY", "change-me-to-a-secure-random-string")
UPLOADER_PORT = int(os.getenv("UPLOADER_PORT", "8002"))

queue = UploadQueue(db_path=str(Path(__file__).parent / "queue.db"))
drive = DriveUploader()
worker = UploadWorker(queue, drive, WEDDING_CODE, WEB_API_URL, AI_SERVICE_URL, UPLOADER_API_KEY)
worker.set_watch_folder(WATCH_FOLDER)
watcher: FolderWatcher | None = None
worker_task: asyncio.Task | None = None
poll_task: asyncio.Task | None = None

wedding_info = {"brideName": "", "groomName": ""}


async def fetch_wedding_info():
    global wedding_info
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{WEB_API_URL}/api/weddings/{WEDDING_CODE}")
            if response.status_code == 200:
                data = response.json()
                wedding_info = {
                    "brideName": data.get("brideName", ""),
                    "groomName": data.get("groomName", ""),
                }
    except Exception as e:
        logger.warning(f"Could not fetch wedding info: {e}")


def on_new_photo(file_path: str):
    worker.enqueue_file(file_path)


async def poll_watcher():
    while True:
        if watcher:
            watcher.poll_stable()
        await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global watcher, worker_task, poll_task

    await fetch_wedding_info()

    watcher = FolderWatcher(WATCH_FOLDER, on_new_photo)
    watcher.start()

    worker_task = asyncio.create_task(worker.run_loop())
    poll_task = asyncio.create_task(poll_watcher())

    logger.info(f"Uploader started. Watching: {WATCH_FOLDER}")
    logger.info(f"Wedding: {WEDDING_CODE}")

    yield

    worker.stop()
    if watcher:
        watcher.stop()
    if worker_task:
        worker_task.cancel()
    if poll_task:
        poll_task.cancel()


app = FastAPI(title="Local Photo Uploader", lifespan=lifespan)


@app.get("/", response_class=HTMLResponse)
async def dashboard():
    return DASHBOARD_HTML


@app.get("/api/status")
async def status():
    stats = queue.get_stats()
    couple = ""
    if wedding_info.get("groomName") and wedding_info.get("brideName"):
        couple = f"{wedding_info['groomName']} ❤️ {wedding_info['brideName']}"

    # Run is_connected in a thread because it makes a synchronous HTTP request
    drive_connected = await asyncio.to_thread(drive.is_connected)

    return {
        "weddingCode": WEDDING_CODE,
        "couple": couple,
        "watchFolder": WATCH_FOLDER,
        "driveConnected": drive_connected,
        "paused": worker.is_paused,
        "stats": stats,
    }


@app.post("/api/pause")
async def pause():
    worker.pause()
    return {"paused": True}


@app.post("/api/resume")
async def resume():
    worker.resume()
    return {"paused": False}


@app.post("/api/retry-failed")
async def retry_failed():
    count = queue.retry_failed()
    return {"retriedCount": count}


@app.post("/api/open-folder")
async def open_folder():
    folder = Path(WATCH_FOLDER)
    folder.mkdir(parents=True, exist_ok=True)
    if sys.platform == "win32":
        os.startfile(str(folder))
    elif sys.platform == "darwin":
        subprocess.run(["open", str(folder)])
    else:
        subprocess.run(["xdg-open", str(folder)])
    return {"opened": str(folder)}


@app.post("/api/change-folder")
async def change_folder():
    global WATCH_FOLDER, watcher
    
    def prompt_folder():
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        selected = filedialog.askdirectory(title="Select the Wedding Photos Folder to Watch", initialdir=WATCH_FOLDER)
        root.destroy()
        return selected

    selected_folder = await asyncio.to_thread(prompt_folder)
    if selected_folder:
        WATCH_FOLDER = selected_folder
        worker.set_watch_folder(WATCH_FOLDER)
        if watcher:
            watcher.stop()
        watcher = FolderWatcher(WATCH_FOLDER, on_new_photo)
        watcher.start()
        
        # Save to .env so it persists across restarts
        env_path = Path(__file__).parent / ".env"
        if env_path.exists():
            with open(env_path, "r") as f:
                lines = f.readlines()
            with open(env_path, "w") as f:
                for line in lines:
                    if line.startswith("WATCH_FOLDER="):
                        f.write(f"WATCH_FOLDER={WATCH_FOLDER}\n")
                    else:
                        f.write(line)
        
        logger.info(f"Changed watch folder to: {WATCH_FOLDER}")
        return {"success": True, "folder": WATCH_FOLDER}
    
    return {"success": False, "folder": WATCH_FOLDER}


@app.post("/api/clear-queue")
async def clear_queue():
    count = queue.clear_all()
    logger.info(f"Cleared local queue. Removed {count} items.")
    return {"clearedCount": count}


@app.post("/api/clear-drive")
async def clear_drive():
    logger.info(f"Clearing drive photos for wedding: {WEDDING_CODE}")
    count = await asyncio.to_thread(drive.clear_wedding_photos, WEDDING_CODE)
    logger.info(f"Cleared {count} photos from drive.")
    return {"clearedCount": count}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=UPLOADER_PORT, reload=False)

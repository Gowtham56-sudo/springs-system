"""Persistent local upload queue with SQLite backend."""

import json
import sqlite3
import threading
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional


class QueueState(str, Enum):
    WAITING = "waiting"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class UploadQueue:
    def __init__(self, db_path: str = "queue.db"):
        self.db_path = Path(db_path)
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS upload_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL UNIQUE,
                    file_name TEXT NOT NULL,
                    file_hash TEXT,
                    state TEXT NOT NULL DEFAULT 'waiting',
                    retry_count INTEGER DEFAULT 0,
                    last_error TEXT,
                    photo_id TEXT,
                    google_drive_file_id TEXT,
                    thumbnail_file_id TEXT,
                    upload_progress REAL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_state ON upload_queue(state)"
            )

    def add(self, file_path: str, file_name: str, file_hash: str) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, sqlite3.connect(self.db_path) as conn:
            try:
                conn.execute(
                    """INSERT INTO upload_queue
                       (file_path, file_name, file_hash, state, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (file_path, file_name, file_hash, QueueState.WAITING.value, now, now),
                )
                return True
            except sqlite3.IntegrityError:
                return False

    def get_next(self) -> Optional[dict]:
        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                """SELECT * FROM upload_queue
                   WHERE state = 'waiting'
                   ORDER BY created_at ASC
                   LIMIT 1"""
            ).fetchone()
            return dict(row) if row else None

    def update_state(
        self,
        item_id: int,
        state: QueueState,
        **kwargs,
    ):
        now = datetime.now(timezone.utc).isoformat()
        fields = ["state = ?", "updated_at = ?"]
        values: list = [state.value, now]

        for key, val in kwargs.items():
            fields.append(f"{key} = ?")
            values.append(val)

        values.append(item_id)

        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                f"UPDATE upload_queue SET {', '.join(fields)} WHERE id = ?",
                values,
            )

    def increment_retry(self, item_id: int, error: str, next_state: QueueState = QueueState.FAILED):
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """UPDATE upload_queue
                   SET retry_count = retry_count + 1,
                       last_error = ?,
                       state = ?,
                       updated_at = ?
                   WHERE id = ?""",
                (error, next_state.value, now, item_id),
            )

    def get_stats(self) -> dict:
        with self._lock, sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM upload_queue").fetchone()[0]
            by_state = {}
            for row in conn.execute(
                "SELECT state, COUNT(*) as cnt FROM upload_queue GROUP BY state"
            ):
                by_state[row[0]] = row[1]

            current = conn.execute(
                """SELECT file_name, state, upload_progress FROM upload_queue
                   WHERE state IN ('uploading', 'processing')
                   ORDER BY updated_at DESC LIMIT 1"""
            ).fetchone()

        return {
            "total": total,
            "waiting": by_state.get("waiting", 0),
            "uploading": by_state.get("uploading", 0),
            "uploaded": by_state.get("uploaded", 0),
            "processing": by_state.get("processing", 0),
            "completed": by_state.get("completed", 0),
            "failed": by_state.get("failed", 0),
            "current": {
                "fileName": current[0] if current else None,
                "state": current[1] if current else None,
                "progress": current[2] if current else 0,
            },
        }

    def get_failed_items(self) -> list[dict]:
        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM upload_queue WHERE state = 'failed' ORDER BY updated_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def retry_failed(self) -> int:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """UPDATE upload_queue SET state = ?, updated_at = ?, last_error = NULL
                   WHERE state = 'failed'""",
                (QueueState.WAITING.value, now),
            )
            return cursor.rowcount

    def reset_to_waiting(self, item_id: int):
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "UPDATE upload_queue SET state = ?, updated_at = ? WHERE id = ?",
                (QueueState.WAITING.value, now, item_id),
            )

    def clear_all(self) -> int:
        with self._lock, sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM upload_queue")
            return cursor.rowcount

"""Google Drive upload client for local uploader."""

import io
import os
import httpx
import typing
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request


class DriveUploader:
    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
        self.refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN", "")
        self._token = None

    def _get_token(self) -> str:
        creds = Credentials(
            token=None,
            refresh_token=self.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
        )
        creds.refresh(Request())
        self._token = creds.token
        if self._token is None:
            raise ValueError("Failed to retrieve Google Drive token")
        return self._token

    def _get_headers(self) -> dict:
        return {"Authorization": f"Bearer {self._get_token()}"}

    def reset_connection(self):
        """Reset cached tokens or state if needed."""
        self._token = None

    def is_connected(self) -> bool:
        try:
            with httpx.Client() as client:
                res = client.get(
                    "https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)",
                    headers=self._get_headers(),
                    timeout=10.0
                )
                res.raise_for_status()
                return True
        except Exception as e:
            print(f"is_connected error: {e}")
            return False

    def _find_folder(self, name: str, parent_id: str | None = None) -> str | None:
        query = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"
        
        with httpx.Client() as client:
            res = client.get(
                "https://www.googleapis.com/drive/v3/files",
                params={"q": query, "fields": "files(id)"},
                headers=self._get_headers(),
                timeout=15.0
            )
            res.raise_for_status()
            files = res.json().get("files", [])
            return files[0]["id"] if files else None

    def _create_folder(self, name: str, parent_id: str | None = None) -> str:
        metadata: dict[str, typing.Any] = {
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
        }
        if parent_id:
            metadata["parents"] = [parent_id]
            
        with httpx.Client() as client:
            res = client.post(
                "https://www.googleapis.com/drive/v3/files",
                json=metadata,
                headers=self._get_headers(),
                timeout=15.0
            )
            res.raise_for_status()
            return res.json()["id"]

    def _get_or_create_folder(self, name: str, parent_id: str | None = None) -> str:
        folder_id = self._find_folder(name, parent_id)
        if folder_id:
            return folder_id
        return self._create_folder(name, parent_id)

    def get_wedding_folders(self, wedding_code: str, local_folder_name: str = "Originals") -> dict | None:
        root_id = self._get_or_create_folder("WeddingPhotoSystem")
        wedding_id = self._get_or_create_folder(wedding_code, root_id)
        originals_id = self._get_or_create_folder(local_folder_name, wedding_id)
        thumbnails_id = self._get_or_create_folder("Thumbnails", wedding_id)

        return {
            "originalsFolderId": originals_id,
            "thumbnailsFolderId": thumbnails_id,
        }

    def _do_resumable_upload(self, file_name: str, mime_type: str, parent_folder_id: str, buffer: bytes) -> str:
        with httpx.Client() as client:
            # Step 1: Init resumable session
            init_headers = self._get_headers()
            init_headers.update({
                "Content-Type": "application/json",
                "X-Upload-Content-Type": mime_type,
                "X-Upload-Content-Length": str(len(buffer))
            })
            metadata = {
                "name": file_name,
                "parents": [parent_folder_id]
            }
            
            init_res = client.post(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
                headers=init_headers,
                json=metadata,
                timeout=15.0
            )
            init_res.raise_for_status()
            upload_url = init_res.headers["Location"]
            
            # Step 2: Upload bytes
            upload_res = client.put(
                upload_url,
                content=buffer,
                headers={"Content-Type": mime_type},
                timeout=120.0  # Large timeout for the actual upload
            )
            upload_res.raise_for_status()
            return upload_res.json()["id"]

    def upload_file(
        self,
        file_path: str,
        file_name: str,
        mime_type: str,
        parent_folder_id: str,
    ) -> str:
        with open(file_path, "rb") as f:
            buffer = f.read()
        return self._do_resumable_upload(file_name, mime_type, parent_folder_id, buffer)

    def upload_buffer(
        self,
        buffer: bytes,
        file_name: str,
        mime_type: str,
        parent_folder_id: str,
    ) -> str:
        return self._do_resumable_upload(file_name, mime_type, parent_folder_id, buffer)

    def clear_wedding_photos(self, wedding_code: str) -> int:
        folders = self.get_wedding_folders(wedding_code)
        if not folders:
            return 0
            
        deleted_count = 0
        headers = self._get_headers()
        
        with httpx.Client() as client:
            for folder_id in [folders["originalsFolderId"], folders["thumbnailsFolderId"]]:
                query = f"'{folder_id}' in parents and trashed=false"
                page_token = None
                while True:
                    params = {"q": query, "fields": "nextPageToken, files(id)"}
                    if page_token:
                        params["pageToken"] = page_token
                        
                    res = client.get(
                        "https://www.googleapis.com/drive/v3/files",
                        params=params,
                        headers=headers,
                        timeout=15.0
                    )
                    res.raise_for_status()
                    data = res.json()
                    
                    for file in data.get("files", []):
                        try:
                            # Trash the file
                            patch_res = client.patch(
                                f"https://www.googleapis.com/drive/v3/files/{file['id']}",
                                headers=headers,
                                json={"trashed": True},
                                timeout=15.0
                            )
                            patch_res.raise_for_status()
                            deleted_count += 1
                        except Exception as e:
                            print(f"Error trashing file {file['id']}: {e}")
                    
                    page_token = data.get("nextPageToken")
                    if not page_token:
                        break
                        
        return deleted_count

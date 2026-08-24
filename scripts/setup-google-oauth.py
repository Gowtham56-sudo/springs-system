"""
Google OAuth 2.0 setup script.
Run once to obtain a refresh token for Google Drive API.

Usage:
  python scripts/setup-google-oauth.py

Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env or environment.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    print("Install dependencies: pip install google-auth-oauthlib python-dotenv")
    sys.exit(1)

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def main():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.")
        sys.exit(1)

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(port=0)

    print("\n" + "=" * 60)
    print("Add this to your .env file:")
    print("=" * 60)
    print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
    print("=" * 60)


if __name__ == "__main__":
    main()

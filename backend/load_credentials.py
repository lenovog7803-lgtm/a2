import os
import json
import base64
from pathlib import Path

def get_credentials_path() -> str:
    b64 = os.environ.get("GOOGLE_CREDENTIALS_BASE64")
    if b64:
        creds_path = "/tmp/google_credentials.json"
        with open(creds_path, "w") as f:
            json.dump(json.loads(base64.b64decode(b64).decode()), f)
        return creds_path
    path = os.environ.get("GOOGLE_CREDENTIALS_PATH", "google_credentials.json")
    root = Path(__file__).parent
    return path if os.path.isabs(path) else str(root / path)

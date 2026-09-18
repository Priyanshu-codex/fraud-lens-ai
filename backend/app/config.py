"""
FraudLens AI — Backend Configuration
"""
from __future__ import annotations

import os
from pathlib import Path


class Settings:
    # Paths
    ROOT_DIR: Path = Path(__file__).resolve().parents[2]
    MODELS_DIR: Path = ROOT_DIR / "models"

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        os.getenv("FRONTEND_URL", ""),
    ]

    # App
    APP_TITLE: str = "FraudLens AI"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"


settings = Settings()

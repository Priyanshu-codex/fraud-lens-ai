"""
FraudLens AI — Backend Configuration
Centralizes environment variables and directory paths.
"""
from __future__ import annotations

import os
from pathlib import Path


def _load_env_file(filepath: Path) -> None:
    """Load key-value pairs from an env file into os.environ if not already set."""
    if not filepath.is_file():
        return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("'\"")
                if key and key not in os.environ:
                    os.environ[key] = val
    except Exception:
        pass


# Base directories
BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = Path(__file__).resolve().parents[2]

# Automatically discover and load .env files
_load_env_file(BACKEND_DIR / ".env")
_load_env_file(ROOT_DIR / ".env")


class Settings:
    # Directory Paths
    ROOT_DIR: Path = ROOT_DIR
    BACKEND_DIR: Path = BACKEND_DIR
    MODELS_DIR: Path = BACKEND_DIR / "models"

    # Supabase Database Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "").strip()

    # CORS & Frontend URL
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000").strip()
    
    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
        if self.FRONTEND_URL:
            origins.append(self.FRONTEND_URL)
        
        custom_cors = os.getenv("CORS_ORIGINS", "").strip()
        if custom_cors:
            for item in custom_cors.split(","):
                cleaned = item.strip()
                if cleaned and cleaned not in origins:
                    origins.append(cleaned)
        return [o for o in set(origins) if o]

    # Application Metadata
    APP_TITLE: str = "FraudLens AI"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"


settings = Settings()

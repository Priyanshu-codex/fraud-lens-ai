"""
FraudLens AI — Vercel Serverless Function Entrypoint
=====================================================
Official Vercel Python entrypoint for unified full-stack deployment.
Exposes the FastAPI application instance (`app`) loaded by @vercel/python.
Enables running the Next.js frontend and FastAPI backend inside a single Vercel project.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# Add repository root and backend directory to sys.path
API_DIR = Path(__file__).resolve().parent
REPO_ROOT = API_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"

for p in [str(REPO_ROOT), str(BACKEND_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Ensure MODELS_DIR points to backend/models
models_candidates = [
    BACKEND_DIR / "models",
    REPO_ROOT / "models",
    Path.cwd() / "backend" / "models",
    Path.cwd() / "models",
]
for candidate in models_candidates:
    if candidate.is_dir() and (candidate / "fraud_model.joblib").exists():
        os.environ["MODELS_DIR"] = str(candidate)
        break

# Import FastAPI application
from backend.app.main import app

# Eagerly load model artifacts for serverless execution where lifespan events may be deferred
from backend.app.ml.loader import artifacts
if not artifacts.loaded:
    try:
        artifacts.load()
    except Exception as exc:
        logging.getLogger(__name__).warning("Eager model loading in Vercel function: %s", exc)

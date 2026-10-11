"""
FraudLens AI — Production Backend Server Launcher
==================================================
Production launcher that:
- Binds to 0.0.0.0 and dynamic cloud assigned $PORT (Render, Railway, Fly, Heroku).
- Enforces bounded concurrency (default 1 worker) to prevent XGBoost/SHAP RAM exhaustion on 512MB-1GB instances.
- Enables proxy headers for proper SSL / client IP termination behind reverse proxies.
- Configures HTTP keepalive (65s) to exceed Cloudflare / ALB / Render default idle timeouts.
- Automatically normalizes sys.path whether executed from repository root or backend folder.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Add backend and repository root directories to sys.path
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parent
REPO_ROOT = BACKEND_DIR.parent

for path_entry in [str(BACKEND_DIR), str(REPO_ROOT)]:
    if path_entry not in sys.path:
        sys.path.insert(0, path_entry)

import uvicorn


def run_production_server() -> None:
    host = os.environ.get("HOST", "0.0.0.0").strip()
    port = int(os.environ.get("PORT", "8000"))
    
    # Bounded concurrency: 1 worker uses ~200-250MB RAM with XGBoost/SHAP.
    # Multiple workers multiply memory by N, which can trigger Linux OOM kills on 512MB plans.
    workers = int(os.environ.get("WORKERS", os.environ.get("WEB_CONCURRENCY", "1")))
    
    reload_enabled = os.environ.get("RELOAD", "false").lower() in ("true", "1")

    print("=" * 60)
    print(" FraudLens AI — Production Backend Server")
    print(f" Host: {host} | Port: {port} | Workers: {workers}")
    print(f" Environment: {'Development (reload)' if reload_enabled else 'Production (persistent)'}")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        workers=workers if not reload_enabled else 1,
        reload=reload_enabled,
        proxy_headers=True,
        forwarded_allow_ips="*",
        timeout_keep_alive=65,
        access_log=True,
    )


if __name__ == "__main__":
    run_production_server()

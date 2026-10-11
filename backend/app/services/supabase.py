"""
FraudLens AI — Supabase Client Service
Provides centralized client initialization, connection verification, and dependency injection.
"""
from __future__ import annotations

import logging
from typing import Optional
from supabase import create_client, Client

from ..config import settings

log = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None
_db_status_cache: dict = {
    "connected": False,
    "last_checked": 0.0,
    "ttl_seconds": 60.0,
}


def is_supabase_configured() -> bool:
    """Check if credentials for Supabase are present in configuration."""
    return bool(
        settings.SUPABASE_URL
        and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY)
    )


def get_supabase_client() -> Optional[Client]:
    """
    Dependency provider and singleton accessor for the Supabase client.
    Returns None gracefully if SUPABASE_URL or keys are not configured.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL
    # Prefer service role key for backend operations; fallback to anon key if provided
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY

    if not url or not key:
        return None

    try:
        _supabase_client = create_client(url, key)
        return _supabase_client
    except Exception as exc:
        log.warning("Could not initialize Supabase client: %s", exc)
        return None


def check_supabase_connection(force: bool = False) -> bool:
    """
    Check if Supabase client is configured and can communicate with PostgreSQL.
    Caches verification status for 60 seconds so health check probes do not block
    on external network requests.
    Returns True if reachable, False otherwise without raising exceptions.
    """
    import time
    now = time.time()

    if not force and (now - _db_status_cache["last_checked"] < _db_status_cache["ttl_seconds"]):
        return bool(_db_status_cache["connected"])

    if not is_supabase_configured():
        _db_status_cache["connected"] = False
        _db_status_cache["last_checked"] = now
        return False

    client = get_supabase_client()
    if client is None:
        _db_status_cache["connected"] = False
        _db_status_cache["last_checked"] = now
        return False

    try:
        # Perform a lightweight ping to verify table or connection access
        client.table("fraud_analyses").select("id", count="exact").limit(1).execute()
        _db_status_cache["connected"] = True
        _db_status_cache["last_checked"] = now
        log.info("Supabase connection verified successfully. Ready for PostgreSQL persistence.")
        return True
    except Exception as exc:
        _db_status_cache["connected"] = False
        _db_status_cache["last_checked"] = now
        log.warning("Supabase connection check warning: %s (backend inference remains fully operational)", exc)
        return False


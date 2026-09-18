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


def check_supabase_connection() -> bool:
    """
    Check if Supabase client is configured and can communicate with PostgreSQL.
    Returns True if reachable, False otherwise without raising exceptions.
    """
    client = get_supabase_client()
    if client is None:
        log.info("Supabase client is not configured (SUPABASE_URL or keys not set). Operating in offline persistence mode.")
        return False

    try:
        # Perform a lightweight ping to verify table or connection access
        res = client.table("fraud_analyses").select("id", count="exact").limit(1).execute()
        log.info("Supabase connection verified successfully. Ready for PostgreSQL persistence.")
        return True
    except Exception as exc:
        log.warning("Supabase connection check warning: %s (backend inference remains fully operational)", exc)
        return False

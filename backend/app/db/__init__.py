"""FraudLens AI — Database Package (Supabase PostgreSQL)."""
from ..services.supabase import get_supabase_client, check_supabase_connection

__all__ = [
    "get_supabase_client",
    "check_supabase_connection",
]

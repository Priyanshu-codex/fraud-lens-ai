# FraudLens AI — Database Migrations

This directory contains the sequential SQL migrations for FraudLens AI on Supabase PostgreSQL.

## Migration Order

1. **`000_initial_schema.sql`**
   - Core tables: `transactions`, `fraud_analyses`, `analysis_evidence`, `investigations`, `audit_logs`
   - Extensions: `pgcrypto` (UUID generation)
   - Indexes: Performance optimization on `prediction`, `risk_level`, `created_at`
   - Triggers: Automatic `updated_at` synchronization on `investigations`
   - Row Level Security (RLS) policies

2. **`001_create_notifications.sql`**
   - Notification table: `notifications`
   - Foreign key to `fraud_analyses(id)` with `UNIQUE(analysis_id)` to prevent duplicate alerts
   - Indexes: `user_id`, `is_read`, `created_at`
   - Row Level Security (RLS) policies for authenticated and service roles

## Applying to Supabase

Run the SQL scripts in numerical order using the **Supabase SQL Editor** or Supabase CLI:
```bash
supabase db push
# Or copy-paste into the Supabase Dashboard SQL Editor
```

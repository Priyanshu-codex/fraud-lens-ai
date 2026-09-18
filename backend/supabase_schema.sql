-- ==============================================================================
-- FraudLens AI — Supabase PostgreSQL Schema & Row Level Security (RLS)
-- ==============================================================================
-- Run this script in the Supabase SQL Editor to set up all tables, indexes,
-- triggers, and Row Level Security policies. Safe to re-run (idempotent).
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Profiles Table (linked to Supabase Auth)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'analyst' NOT NULL, -- 'analyst', 'admin', 'auditor'
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ==============================================================================
-- 2. Transactions Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    source VARCHAR(50) DEFAULT 'custom' NOT NULL, -- 'fraud_sample', 'legitimate_sample', 'custom'
    time DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    -- 28 PCA features (V1 through V28)
    v1 DOUBLE PRECISION NOT NULL,
    v2 DOUBLE PRECISION NOT NULL,
    v3 DOUBLE PRECISION NOT NULL,
    v4 DOUBLE PRECISION NOT NULL,
    v5 DOUBLE PRECISION NOT NULL,
    v6 DOUBLE PRECISION NOT NULL,
    v7 DOUBLE PRECISION NOT NULL,
    v8 DOUBLE PRECISION NOT NULL,
    v9 DOUBLE PRECISION NOT NULL,
    v10 DOUBLE PRECISION NOT NULL,
    v11 DOUBLE PRECISION NOT NULL,
    v12 DOUBLE PRECISION NOT NULL,
    v13 DOUBLE PRECISION NOT NULL,
    v14 DOUBLE PRECISION NOT NULL,
    v15 DOUBLE PRECISION NOT NULL,
    v16 DOUBLE PRECISION NOT NULL,
    v17 DOUBLE PRECISION NOT NULL,
    v18 DOUBLE PRECISION NOT NULL,
    v19 DOUBLE PRECISION NOT NULL,
    v20 DOUBLE PRECISION NOT NULL,
    v21 DOUBLE PRECISION NOT NULL,
    v22 DOUBLE PRECISION NOT NULL,
    v23 DOUBLE PRECISION NOT NULL,
    v24 DOUBLE PRECISION NOT NULL,
    v25 DOUBLE PRECISION NOT NULL,
    v26 DOUBLE PRECISION NOT NULL,
    v27 DOUBLE PRECISION NOT NULL,
    v28 DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions(source);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- ==============================================================================
-- 3. Fraud Analyses Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fraud_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    fraud_probability DOUBLE PRECISION NOT NULL,
    prediction VARCHAR(20) NOT NULL, -- 'FRAUD', 'LEGITIMATE'
    risk_level VARCHAR(20) NOT NULL, -- 'LOW', 'REVIEW', 'HIGH'
    threshold DOUBLE PRECISION NOT NULL,
    model_name VARCHAR(50) DEFAULT 'XGBoost' NOT NULL,
    model_version VARCHAR(50) DEFAULT 'v1.0.0' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fraud_analyses_tx_id ON public.fraud_analyses(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_analyses_risk ON public.fraud_analyses(risk_level);
CREATE INDEX IF NOT EXISTS idx_fraud_analyses_pred ON public.fraud_analyses(prediction);
CREATE INDEX IF NOT EXISTS idx_fraud_analyses_created_at ON public.fraud_analyses(created_at DESC);

-- ==============================================================================
-- 4. Analysis Evidence Table (SHAP feature contributions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES public.fraud_analyses(id) ON DELETE CASCADE,
    feature_name VARCHAR(50) NOT NULL,
    feature_value DOUBLE PRECISION NOT NULL,
    contribution DOUBLE PRECISION NOT NULL,
    direction VARCHAR(20) NOT NULL, -- 'fraud', 'legitimate'
    rank INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_evidence_analysis_id ON public.analysis_evidence(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_evidence_feature ON public.analysis_evidence(feature_name);

-- ==============================================================================
-- 5. Investigations Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL UNIQUE REFERENCES public.fraud_analyses(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'OPEN' NOT NULL, -- 'OPEN', 'UNDER_REVIEW', 'RESOLVED'
    notes TEXT,
    reviewed_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_investigations_analysis_id ON public.investigations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON public.investigations(status);
CREATE INDEX IF NOT EXISTS idx_investigations_created_at ON public.investigations(created_at DESC);

-- ==============================================================================
-- 6. Audit Logs Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'transaction', 'analysis', 'investigation', 'notification'
    entity_id VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 7. Notifications Table (Automatic High-Risk Fraud Alerts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL UNIQUE REFERENCES public.fraud_analyses(id) ON DELETE CASCADE,
    investigation_id UUID REFERENCES public.investigations(id) ON DELETE CASCADE,
    fraud_probability DOUBLE PRECISION NOT NULL,
    risk_level VARCHAR(20) NOT NULL, -- 'HIGH'
    title VARCHAR(255) DEFAULT 'Critical Fraud Alert' NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_analysis_id ON public.notifications(analysis_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ==============================================================================
-- 8. Automatic Updated_at Triggers
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_investigations_updated_at ON public.investigations;
CREATE TRIGGER trigger_investigations_updated_at
    BEFORE UPDATE ON public.investigations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 9. Row Level Security (RLS) Configuration
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ── Service Role Policies (Backend full access via SUPABASE_SERVICE_ROLE_KEY) ──
DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
CREATE POLICY "Service role full access on profiles"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on transactions" ON public.transactions;
CREATE POLICY "Service role full access on transactions"
    ON public.transactions FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on fraud_analyses" ON public.fraud_analyses;
CREATE POLICY "Service role full access on fraud_analyses"
    ON public.fraud_analyses FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on analysis_evidence" ON public.analysis_evidence;
CREATE POLICY "Service role full access on analysis_evidence"
    ON public.analysis_evidence FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on investigations" ON public.investigations;
CREATE POLICY "Service role full access on investigations"
    ON public.investigations FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on audit_logs" ON public.audit_logs;
CREATE POLICY "Service role full access on audit_logs"
    ON public.audit_logs FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on notifications" ON public.notifications;
CREATE POLICY "Service role full access on notifications"
    ON public.notifications FOR ALL
    USING (auth.role() = 'service_role');

-- ── Authenticated User Policies (Users access authorized data) ─────────────────
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their transactions" ON public.transactions;
CREATE POLICY "Users can view their transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can view analyses" ON public.fraud_analyses;
CREATE POLICY "Users can view analyses"
    ON public.fraud_analyses FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can view analysis evidence" ON public.analysis_evidence;
CREATE POLICY "Users can view analysis evidence"
    ON public.analysis_evidence FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can view investigations" ON public.investigations;
CREATE POLICY "Users can view investigations"
    ON public.investigations FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Analysts can update investigations" ON public.investigations;
CREATE POLICY "Analysts can update investigations"
    ON public.investigations FOR UPDATE
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
CREATE POLICY "Users can view notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;
CREATE POLICY "Users can update notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL);

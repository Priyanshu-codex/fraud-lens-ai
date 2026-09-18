-- ==============================================================================
-- FraudLens AI — Migration: Create Notifications Table & RLS
-- ==============================================================================
-- Run this snippet in your Supabase SQL Editor if you already applied the
-- base schema earlier.
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

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Service Role Full Access
DROP POLICY IF EXISTS "Service role full access on notifications" ON public.notifications;
CREATE POLICY "Service role full access on notifications"
    ON public.notifications FOR ALL
    USING (auth.role() = 'service_role');

-- Authenticated Users Read Access
DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
CREATE POLICY "Users can view notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Authenticated Users Update Access (marking as read)
DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;
CREATE POLICY "Users can update notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL);

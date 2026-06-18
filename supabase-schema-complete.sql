-- ============================================================
-- KANI COMPLETE DATABASE SCHEMA — SAFE UPGRADE VERSION
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- This script handles both FRESH installs and UPGRADES from old schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STEP 1: DROP OLD POLICIES — one block per table so a missing
-- table on one doesn't roll back drops on others
-- ============================================================

-- contacts (exists from old schema)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public inserts on contacts" ON contacts;
  DROP POLICY IF EXISTS "Allow admin reads on contacts" ON contacts;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

-- events (exists from old schema)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public reads on active events" ON events;
  DROP POLICY IF EXISTS "Allow admin all on events" ON events;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

-- registrations (exists from old schema)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public inserts on registrations" ON registrations;
  DROP POLICY IF EXISTS "Allow users to see own registrations" ON registrations;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

-- partners (may be new)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow partners to see own profile" ON partners;
  DROP POLICY IF EXISTS "Allow partners to update own profile" ON partners;
  DROP POLICY IF EXISTS "Allow partners to insert own profile" ON partners;
  DROP POLICY IF EXISTS "Allow admin all on partners" ON partners;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

-- prayer_requests (may be new)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow users to insert own prayer requests" ON prayer_requests;
  DROP POLICY IF EXISTS "Allow users to see own prayer requests" ON prayer_requests;
  DROP POLICY IF EXISTS "Allow admin all on prayer requests" ON prayer_requests;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

-- donations (may be new)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public inserts on donations" ON donations;
  DROP POLICY IF EXISTS "Allow users to see own donations" ON donations;
  DROP POLICY IF EXISTS "Allow admin all on donations" ON donations;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

-- newsletter_subscribers (may be new)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public inserts on newsletter" ON newsletter_subscribers;
  DROP POLICY IF EXISTS "Allow admin reads on newsletter" ON newsletter_subscribers;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

-- ============================================================
-- 1. CONTACTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing column if upgrading from old schema
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public inserts on contacts" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin reads on contacts" ON contacts FOR SELECT USING (auth.role() = 'service_role');

-- ============================================================
-- 2. EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    location TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'General',
    capacity INT DEFAULT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    online_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if upgrading from old schema
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INT DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS online_link TEXT;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public reads on active events" ON events FOR SELECT USING (is_active = true);
CREATE POLICY "Allow admin all on events" ON events USING (auth.role() = 'service_role');

-- ============================================================
-- 3. EVENT REGISTRATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS registrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if upgrading from old schema (critical fix for user_id error)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add unique constraint if not exists
DO $$ BEGIN
    ALTER TABLE registrations ADD CONSTRAINT registrations_event_email_unique UNIQUE (event_id, email);
EXCEPTION WHEN duplicate_table THEN NULL;
             WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public inserts on registrations" ON registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to see own registrations" ON registrations FOR SELECT USING (
    auth.uid() = user_id OR auth.role() = 'service_role'
);

-- ============================================================
-- 4. PARTNERS TABLE (User Profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS partners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    country TEXT,
    tier TEXT DEFAULT 'Silver',
    join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow partners to see own profile" ON partners FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow partners to update own profile" ON partners FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow partners to insert own profile" ON partners FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin all on partners" ON partners USING (auth.role() = 'service_role');

-- Auto-create partner profile on signup trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.partners (user_id, first_name, last_name, email)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ============================================================
-- 5. PRAYER REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS prayer_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to insert own prayer requests" ON prayer_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow users to see own prayer requests" ON prayer_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow admin all on prayer requests" ON prayer_requests USING (auth.role() = 'service_role');

-- ============================================================
-- 6. DONATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS donations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'KES',
    frequency TEXT DEFAULT 'one-time',
    designation TEXT DEFAULT 'General Fund',
    paystack_reference TEXT UNIQUE,
    paystack_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public inserts on donations" ON donations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to see own donations" ON donations FOR SELECT USING (
    auth.uid() = user_id OR auth.role() = 'service_role'
);
CREATE POLICY "Allow admin all on donations" ON donations USING (auth.role() = 'service_role');

-- ============================================================
-- 7. NEWSLETTER SUBSCRIBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public inserts on newsletter" ON newsletter_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin reads on newsletter" ON newsletter_subscribers FOR SELECT USING (auth.role() = 'service_role');

-- ============================================================
-- SEED DATA — Sample Events (safe: skips if already exists)
-- ============================================================
INSERT INTO events (title, description, event_date, end_date, location, type, capacity, is_online) VALUES
(
    'Night of Kingdom Power — Global Prayer Meeting',
    'Join believers from around the world for a night of intense prayer, worship, and prophetic impartation. Experience the manifest presence of God as we contend together for global revival.',
    NOW() + INTERVAL '28 days',
    NOW() + INTERVAL '28 days' + INTERVAL '5 hours',
    'Nairobi, Kenya & Online',
    'Prayer',
    500,
    true
),
(
    'Kingdom Ambassadors Masterclass 2026',
    'A 3-day intensive equipping session for pastors, ministry leaders, and marketplace ministers. Receive cutting-edge teaching on kingdom governance, discipleship, and apostolic leadership.',
    NOW() + INTERVAL '45 days',
    NOW() + INTERVAL '48 days',
    'Kenyatta International Convention Centre, Nairobi',
    'Conference',
    1200,
    false
),
(
    'Global Leadership Summit',
    'An annual gathering of kingdom leaders from across the nations. Featuring internationally recognised speakers, worship encounters, and strategic ministry breakout sessions.',
    NOW() + INTERVAL '70 days',
    NOW() + INTERVAL '72 days',
    'Johannesburg, South Africa',
    'Conference',
    2000,
    false
),
(
    'Marketplace Ministers Training',
    'Equipping Christians in the workplace to be effective kingdom ambassadors in business, government, arts and media. Practical and prophetic.',
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '14 days' + INTERVAL '8 hours',
    'Online via Zoom',
    'Training',
    NULL,
    true
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE! All tables, policies, trigger, and seed data applied.
-- ============================================================
SELECT 'KANI schema applied successfully ✅' AS result;

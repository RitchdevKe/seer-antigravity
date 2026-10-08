-- 1. Create table for persistent config and backups
CREATE TABLE IF NOT EXISTS user_storage (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create the main precalculated_matches table
CREATE TABLE IF NOT EXISTS precalculated_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    result TEXT,
    date TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create group tables (group_1_matches, group_2_matches, group_3_matches)
CREATE TABLE IF NOT EXISTS group_1_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    result TEXT,
    date TEXT,
    main_pattern TEXT,
    sub_pattern TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_2_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    result TEXT,
    date TEXT,
    main_pattern TEXT,
    sub_pattern TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_3_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    result TEXT,
    date TEXT,
    main_pattern TEXT,
    sub_pattern TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create general pattern & sub-pattern table
CREATE TABLE IF NOT EXISTS pattern_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    result TEXT,
    date TEXT,
    group_id INT,
    main_pattern TEXT,
    sub_pattern TEXT,
    paa_outcome TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure paa_outcome column exists if the table was created previously
ALTER TABLE pattern_matches ADD COLUMN IF NOT EXISTS paa_outcome TEXT;

-- 5. Highly performant Indexes for rapid queries and filters
CREATE INDEX IF NOT EXISTS idx_precalculated_matches_date ON precalculated_matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_group_1_matches_date ON group_1_matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_group_2_matches_date ON group_2_matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_group_3_matches_date ON group_3_matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_matches_group ON pattern_matches(group_id);
CREATE INDEX IF NOT EXISTS idx_pattern_matches_main_pattern ON pattern_matches(main_pattern);
CREATE INDEX IF NOT EXISTS idx_pattern_matches_sub_pattern ON pattern_matches(sub_pattern);
CREATE INDEX IF NOT EXISTS idx_pattern_matches_paa_outcome ON pattern_matches(paa_outcome);

-- Transition: If it was previously a table, drop it safely.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pattern_accuracy_audit') THEN
        EXECUTE 'DROP TABLE public.pattern_accuracy_audit CASCADE';
    END IF;
END
$$;

-- Pattern Accuracy Audit (Auto-Updating via View)
CREATE OR REPLACE VIEW pattern_accuracy_audit AS
SELECT 
    sub_pattern,
    group_id,
    COUNT(*) as total,
    SUM(CASE WHEN paa_outcome = 'fav_win' THEN 1 ELSE 0 END) as fav_win,
    SUM(CASE WHEN paa_outcome = 'draw' THEN 1 ELSE 0 END) as draw,
    SUM(CASE WHEN paa_outcome = 'upset_win' THEN 1 ELSE 0 END) as upset_win
FROM pattern_matches
WHERE sub_pattern IS NOT NULL AND paa_outcome IS NOT NULL AND paa_outcome != 'pending'
GROUP BY sub_pattern, group_id;




-- 6. Tables for Seer Locked Slips and performance/jackpot snapshots
CREATE TABLE IF NOT EXISTS seer_locked_slips (
    id TEXT PRIMARY KEY,
    date TEXT,
    category TEXT,
    type TEXT,
    picks JSONB,
    backups JSONB,
    weights_at_time JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seer_performance_history (
    date TEXT PRIMARY KEY,
    compressed_matches TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seer_jackpot_history (
    date TEXT PRIMARY KEY,
    compressed_matches TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seer_performance_cache (
    id TEXT PRIMARY KEY, -- {collection}_{category}_{date}
    collection TEXT,
    category TEXT,
    date TEXT,
    accuracy NUMERIC,
    goal_accuracy NUMERIC,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Highly performant Indexes for Seer
CREATE INDEX IF NOT EXISTS idx_seer_locked_slips_date ON seer_locked_slips(date DESC);
CREATE INDEX IF NOT EXISTS idx_seer_performance_cache_lookup ON seer_performance_cache(collection, category, date);

-- 7. Tables for Nerdy Matches
CREATE TABLE IF NOT EXISTS nerdy_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    date TEXT,
    analysis TEXT,
    percentage TEXT,
    stars TEXT,
    tip TEXT,
    odds TEXT,
    result TEXT,
    jackpot_ids TEXT[],
    rating1x2 TEXT,
    gs TEXT,
    ga TEXT,
    l10 TEXT,
    le TEXT,
    mo TEXT,
    pred1x2 TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nerdy_jackpot_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    date TEXT,
    analysis TEXT,
    percentage TEXT,
    stars TEXT,
    tip TEXT,
    odds TEXT,
    result TEXT,
    jackpot_ids TEXT[],
    rating1x2 TEXT,
    gs TEXT,
    ga TEXT,
    l10 TEXT,
    le TEXT,
    mo TEXT,
    pred1x2 TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nerdy_matches_date ON nerdy_matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_nerdy_jackpot_matches_date ON nerdy_jackpot_matches(date DESC);

-- 8. Table for Users management
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL,
    branch TEXT,
    email TEXT,
    status TEXT NOT NULL,
    reg_date TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 9. Disable Row Level Security (RLS) & Grant Full Permissions to anon/authenticated roles
-- Since authentication is handled via Firebase, the Supabase client acts as an anonymous/authenticated client.
-- Disabling RLS ensures there are no fetch/insert blocks during login or syncing.

ALTER TABLE IF EXISTS user_storage DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS precalculated_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_1_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_2_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_3_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pattern_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seer_locked_slips DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seer_performance_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seer_jackpot_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seer_performance_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nerdy_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nerdy_jackpot_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;

-- Explicit policies to allow all operations for anon/authenticated roles
-- This acts as a fallback even if RLS is enabled.
DO $$ 
BEGIN
    -- Nerdy Matches policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nerdy_matches' AND policyname = 'Allow all for nerdy_matches') THEN
        CREATE POLICY "Allow all for nerdy_matches" ON nerdy_matches FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Nerdy Jackpot Matches policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nerdy_jackpot_matches' AND policyname = 'Allow all for nerdy_jackpot_matches') THEN
        CREATE POLICY "Allow all for nerdy_jackpot_matches" ON nerdy_jackpot_matches FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Other tables
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'precalculated_matches' AND policyname = 'Allow all for precalculated_matches') THEN
        CREATE POLICY "Allow all for precalculated_matches" ON precalculated_matches FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- User Uploaded Matches policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_uploaded_matches' AND policyname = 'Allow all for user_uploaded_matches') THEN
        CREATE POLICY "Allow all for user_uploaded_matches" ON user_uploaded_matches FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Live Matches policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_matches' AND policyname = 'Allow all for live_matches') THEN
        CREATE POLICY "Allow all for live_matches" ON live_matches FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

GRANT ALL ON TABLE user_storage TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE precalculated_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE group_1_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE group_2_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE group_3_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE pattern_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE seer_locked_slips TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE seer_performance_history TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE seer_jackpot_history TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE seer_performance_cache TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE nerdy_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE nerdy_jackpot_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE users TO anon, authenticated, postgres, service_role;

-- 10. Safety Schema Upgrades for Nerdy Tips tables
-- In case tables were created with minimal columns in prior sessions, run these safe ALTER commands to enable full columns.
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS rating1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS gs TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS ga TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS l10 TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS le TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS mo TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS pred1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS data JSONB;

ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS rating1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS gs TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS ga TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS l10 TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS le TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS mo TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS pred1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS data JSONB;

-- 11. Structured Table for User Uploaded & Analyzed Matches (Bypassing LocalStorage/Quota limits)
CREATE TABLE IF NOT EXISTS user_uploaded_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    result TEXT,
    date TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS user_uploaded_matches DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE user_uploaded_matches TO anon, authenticated, postgres, service_role;
CREATE INDEX IF NOT EXISTS idx_user_uploaded_matches_date ON user_uploaded_matches(date DESC);

-- 12. Structured Table for Live Analysis Matches (Bypassing LocalStorage limits)
CREATE TABLE IF NOT EXISTS live_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    result TEXT,
    date TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS live_matches DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE live_matches TO anon, authenticated, postgres, service_role;
CREATE INDEX IF NOT EXISTS idx_live_matches_date ON live_matches(date DESC);


-- 13. Dedicated Table for Supreme Custom Weights
CREATE TABLE IF NOT EXISTS supreme_custom_weights (
    category TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    goal_accuracy NUMERIC NOT NULL,
    overall_accuracy NUMERIC NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category, feature_name)
);

ALTER TABLE IF EXISTS supreme_custom_weights DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE supreme_custom_weights TO anon, authenticated, postgres, service_role;
CREATE INDEX IF NOT EXISTS idx_supreme_custom_weights_lookup ON supreme_custom_weights(category);


-- 14. Dedicated Table for Deleted Match Tombstones
CREATE TABLE IF NOT EXISTS deleted_match_tombstones (
    stable_id TEXT PRIMARY KEY,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS deleted_match_tombstones DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE deleted_match_tombstones TO anon, authenticated, postgres, service_role;
CREATE INDEX IF NOT EXISTS idx_deleted_match_tombstones_date ON deleted_match_tombstones(deleted_at DESC);




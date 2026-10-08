-- Create a dedicated table for SEER AI Slips to ensure they save permanently and load correctly
CREATE TABLE IF NOT EXISTS seer_ai_slips (
    id TEXT PRIMARY KEY,
    date TEXT,
    category TEXT,
    type TEXT,
    picks JSONB,
    backups JSONB,
    weights_at_time JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seer_ai_slips_date ON seer_ai_slips(date DESC);

ALTER TABLE IF EXISTS seer_ai_slips DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE seer_ai_slips TO anon, authenticated, postgres, service_role;

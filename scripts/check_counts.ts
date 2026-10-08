import { Pool } from 'pg';

const rdsConfig = {
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function main() {
  const pool = new Pool(rdsConfig);
  try {
    const res = await pool.query("SELECT count(*) as total, count(*) filter (where result is not null and result not in ('-', 'pending', '')) as completed FROM live_matches");
    console.log('LIVE_MATCHES:', res.rows[0]);

    const slipsRes = await pool.query("SELECT id, date, category, jsonb_array_length(picks) as pick_count FROM seer_locked_slips ORDER BY date DESC LIMIT 20");
    console.log('LOCKED_SLIPS:', slipsRes.rows);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

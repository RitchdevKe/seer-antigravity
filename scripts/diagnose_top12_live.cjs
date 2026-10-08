const { Pool } = require('pg');

const pool = new Pool({
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query('SELECT data FROM live_matches');
  const matches = res.rows.map(r => r.data).filter(Boolean);
  const t12 = matches.filter(m => (m.evaluatorTags || []).some(t => t.startsWith('top12:') || t.startsWith('top10:')));
  
  console.log(`Found ${t12.length} Top 12 matches`);

  t12.forEach((m, idx) => {
    console.log(`\nMatch ${idx + 1}: ${m.teams} | Result: ${m.result}`);
    console.log(`Home odds: ${m.homeOdds || m.mo}, Away odds: ${m.awayOdds}`);
  });

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });

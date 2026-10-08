import { Pool } from 'pg';

const rdsConfig = {
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(rdsConfig);

async function main() {
  try {
    console.log("Connecting to RDS...");
    // Check tables in public schema
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("Tables in DB:", tablesRes.rows.map(r => r.table_name));

    // Check count and recent dates in live_matches
    if (tablesRes.rows.some(r => r.table_name === 'live_matches')) {
      const countRes = await pool.query(`SELECT count(*) FROM live_matches`);
      console.log(`live_matches row count:`, countRes.rows[0].count);

      const recentDates = await pool.query(`
        SELECT SUBSTRING((data->>'date')::text, 1, 10) as match_date, count(*) 
        FROM live_matches 
        WHERE data->>'date' IS NOT NULL
        GROUP BY match_date 
        ORDER BY match_date DESC 
        LIMIT 10;
      `);
      console.log("Recent dates in live_matches:", recentDates.rows);
    }

    // Check nerdy_matches or precalculated_matches or other tables
    for (const t of ['nerdy_matches', 'precalculated_matches', 'user_uploaded_matches']) {
      if (tablesRes.rows.some(r => r.table_name === t)) {
        const c = await pool.query(`SELECT count(*) FROM ${t}`);
        console.log(`${t} count:`, c.rows[0].count);
        const dates = await pool.query(`
          SELECT SUBSTRING((data->>'date')::text, 1, 10) as match_date, count(*) 
          FROM ${t} 
          WHERE data->>'date' IS NOT NULL
          GROUP BY match_date 
          ORDER BY match_date DESC 
          LIMIT 5;
        `);
        console.log(`Recent dates in ${t}:`, dates.rows);
      }
    }
  } catch (err: any) {
    console.error("Database query failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();

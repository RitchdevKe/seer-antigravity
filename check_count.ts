import { Client } from 'pg';

const rdsConfig = {
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function check() {
  const pgClient = new Client(rdsConfig);
  await pgClient.connect();
  const res = await pgClient.query('SELECT COUNT(*) FROM user_uploaded_matches;');
  console.log('user_uploaded_matches count:', res.rows[0].count);
  
  const res2 = await pgClient.query('SELECT COUNT(*) FROM live_matches;');
  console.log('live_matches count:', res2.rows[0].count);
  
  await pgClient.end();
}
check();

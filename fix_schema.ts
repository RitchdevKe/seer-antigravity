import { Client } from 'pg';
import fs from 'fs';

const rdsConfig = {
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function fixSchema() {
  const pgClient = new Client(rdsConfig);
  await pgClient.connect();
  
  let rawSchema = fs.readFileSync('supabase_schema.sql', 'utf8');
  
  // Clean up stuff that causes issues
  rawSchema = rawSchema.replace(/DO \$\$[\s\S]*?\$\$;/g, '');
  rawSchema = rawSchema.replace(/GRANT .*?;/g, '');
  rawSchema = rawSchema.replace(/ALTER TABLE IF EXISTS .*? ROW LEVEL SECURITY;/g, '');
  rawSchema = rawSchema.replace(/CREATE POLICY .*?;/g, '');

  const statements = rawSchema.split(';');
  let successCount = 0;
  
  for (let stmt of statements) {
    stmt = stmt.trim();
    if (!stmt) continue;
    try {
      await pgClient.query(stmt);
      successCount++;
    } catch (e: any) {
      console.log(`Failed statement (First 50 chars): ${stmt.substring(0, 50)}...`);
      console.log(`Error: ${e.message}`);
    }
  }
  
  console.log(`Executed ${successCount} schema statements successfully.`);
  await pgClient.end();
}
fixSchema();

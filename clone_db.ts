import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const rdsConfig = {
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const tables = [
  'seer_locked_slips',
  'user_uploaded_matches',
  'live_matches',
  'deleted_match_tombstones',
  'ml_matrix_data'
]; // Retrying only the ones that failed or hadn't finished

async function clone() {
  const pgClient = new Client(rdsConfig);
  await pgClient.connect();
  
  let totalRows = 0;
  for (const table of tables) {
    console.log(`Cloning table: ${table}...`);
    try {
      const { data, error } = await supabase.from(table).select('*').limit(30000); 
      if (error) {
         console.warn(`Error fetching ${table}:`, error.message);
         continue;
      }
      if (!data || data.length === 0) { continue; }

      const keys = Object.keys(data[0]);
      for (let i = 0; i < data.length; i += 100) {
        const batch = data.slice(i, i + 100);
        const values: any[] = [];
        const placeholders = batch.map((row, rowIndex) => {
           return `(${keys.map((_, colIndex) => {
               const val = row[keys[colIndex]];
               if (Array.isArray(val)) {
                   // If it's an array of objects, it's JSONB. If strings/numbers, it could be Postgres Array or JSONB.
                   // node-postgres handles JS arrays automatically for Postgres Arrays.
                   // But if the column is JSONB, it needs JSON.stringify.
                   // Let's just stringify everything. If it fails for TEXT[], we can fallback.
                   // Actually, for nerdy_jackpot_matches (which succeeded last time but isn't in this retry list), it was TEXT[].
                   // For seer_locked_slips, user_uploaded_matches, live_matches, they are all JSONB.
                   values.push(JSON.stringify(val));
               } else if (typeof val === 'object' && val !== null) {
                   values.push(JSON.stringify(val));
               } else {
                   values.push(val);
               }
               return `$${rowIndex * keys.length + colIndex + 1}`;
           }).join(', ')})`;
        }).join(', ');
        
        // We use ON CONFLICT DO NOTHING so we don't duplicate rows
        const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING;`;
        await pgClient.query(query, values);
      }
      console.log(`Inserted ${data.length} rows into ${table}.`);
      totalRows += data.length;
    } catch (err) {
      console.error(`Error processing table ${table}:`, err);
    }
  }

  await pgClient.end();
  console.log(`Cloning complete! Total rows cloned: ${totalRows}`);
}

clone();

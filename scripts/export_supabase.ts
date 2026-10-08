import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Get Env Variables
const getEnv = (key: string): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
};

// Required dot env parsing if not running via vite
import { config } from 'dotenv';
config();

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLES = [
  'live_matches',
  'user_uploaded_matches',
  'ai_slips',
  'optimised_slips',
  'users',
  'seer_locked_slips',
  'match_tombstones',
  'pattern_cache',
  'deleted_match_tombstones',
  'match_processing_state',
  'ml_matrix_data',
  'ml_matrix_processed_matches',
  'nerdy_jackpot_matches',
  'nerdy_matches',
  'pattern_accuracy_audit',
  'pha_stats',
  'precalculated_matches',
  'profiles',
  'seer_ai_slips',
  'seer_insight_weights_cache',
  'seer_jackpot_history',
  'seer_performance_cache',
  'seer_performance_history',
  'supreme_custom_weights'
];

async function exportTable(tableName: string) {
  console.log(`Starting export of table: ${tableName}`);
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    console.log(`  Fetching page ${page + 1} (offset ${page * pageSize})...`);
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`  Error fetching ${tableName}:`, error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      page++;
      if (data.length < pageSize) {
        hasMore = false; // Last page
      }
    }
  }

  const backupDir = path.join(process.cwd(), 'supabase_backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const filePath = path.join(backupDir, `${tableName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
  console.log(`✅ Successfully exported ${allData.length} rows to ${filePath}\n`);
}

async function main() {
  console.log("Starting Supabase database export...\n");
  for (const table of TABLES) {
    await exportTable(table);
  }
  console.log("Export complete!");
}

main().catch(console.error);

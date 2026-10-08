// Database Clone Script — Exports all Supabase data via REST API (no access token needed)
// Uses the anon key + PostgREST API to fetch all rows from every table

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, '..', 'db_export');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// All tables from the schema
const TABLES = [
  'user_storage',
  'precalculated_matches',
  'group_1_matches',
  'group_2_matches',
  'group_3_matches',
  'pattern_matches',
  'seer_locked_slips',
  'seer_performance_history',
  'seer_jackpot_history',
  'seer_performance_cache',
  'nerdy_matches',
  'nerdy_jackpot_matches',
  'users',
  'user_uploaded_matches',
  'live_matches',
  'supreme_custom_weights',
  'deleted_match_tombstones',
];

async function fetchAllRows(tableName) {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      // Table might not exist yet — skip gracefully
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log(`  ⏭️  Table "${tableName}" does not exist — skipping.`);
        return null;
      }
      console.error(`  ❌ Error fetching "${tableName}":`, error.message);
      return null;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      from += PAGE_SIZE;
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      }
    }
  }

  return allRows;
}

async function main() {
  console.log('🚀 SEER Database Clone — Starting Export');
  console.log(`📡 Supabase URL: ${supabaseUrl}`);
  console.log(`📂 Export directory: ${EXPORT_DIR}\n`);

  // Create export directory
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const summary = {};

  for (const table of TABLES) {
    process.stdout.write(`📦 Exporting "${table}"...`);
    const rows = await fetchAllRows(table);

    if (rows === null) {
      summary[table] = 'SKIPPED';
      continue;
    }

    const filePath = path.join(EXPORT_DIR, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(` ✅ ${rows.length} rows`);
    summary[table] = rows.length;
  }

  // Write summary
  const summaryPath = path.join(EXPORT_DIR, '_export_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    exported_at: new Date().toISOString(),
    supabase_url: supabaseUrl,
    tables: summary,
    total_rows: Object.values(summary).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0),
  }, null, 2), 'utf-8');

  console.log('\n✅ Export complete!');
  console.log('📊 Summary:');
  for (const [table, count] of Object.entries(summary)) {
    console.log(`   ${table}: ${typeof count === 'number' ? count + ' rows' : count}`);
  }
  console.log(`\n📁 Files saved to: ${EXPORT_DIR}`);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

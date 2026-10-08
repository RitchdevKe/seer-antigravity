import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, '..', 'db_export');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  const tableName = 'seer_ai_slips';
  console.log(`📦 Exporting "${tableName}"...`);
  
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(` ❌ Error: ${error.message}`);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      from += PAGE_SIZE;
      if (data.length < PAGE_SIZE) hasMore = false;
    }
  }

  const filePath = path.join(EXPORT_DIR, `${tableName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(allRows, null, 2), 'utf-8');
  console.log(`✅ Exported ${allRows.length} rows to ${filePath}`);

  // Update summary
  const summaryPath = path.join(EXPORT_DIR, '_export_summary.json');
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    summary.tables[tableName] = allRows.length;
    summary.total_rows = Object.values(summary.tables).filter((v): v is number => typeof v === 'number').reduce((a, b) => a + b, 0);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

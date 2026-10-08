// Retry export for user_uploaded_matches with smaller page sizes and longer waits
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
  console.log('🔄 Retrying "user_uploaded_matches" with smaller pages...\n');
  
  const PAGE_SIZE = 200; // smaller pages to avoid timeout
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;
  let pageNum = 0;

  while (hasMore) {
    pageNum++;
    process.stdout.write(`  Page ${pageNum} (rows ${from}-${from + PAGE_SIZE - 1})...`);
    
    const { data, error } = await supabase
      .from('user_uploaded_matches')
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
      .order('date', { ascending: false });

    if (error) {
      console.log(` ❌ Error: ${error.message}`);
      if (allRows.length > 0) {
        console.log(`  Saving ${allRows.length} rows collected so far...`);
        break;
      }
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log(` (empty — done)`);
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      console.log(` ✅ ${data.length} rows (total: ${allRows.length})`);
      from += PAGE_SIZE;
      if (data.length < PAGE_SIZE) hasMore = false;
      // Small delay between pages to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const filePath = path.join(EXPORT_DIR, 'user_uploaded_matches.json');
  fs.writeFileSync(filePath, JSON.stringify(allRows, null, 2), 'utf-8');
  console.log(`\n✅ Exported ${allRows.length} rows to ${filePath}`);

  // Update summary
  const summaryPath = path.join(EXPORT_DIR, '_export_summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  summary.tables.user_uploaded_matches = allRows.length;
  summary.total_rows = Object.values(summary.tables).filter((v): v is number => typeof v === 'number').reduce((a, b) => a + b, 0);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});

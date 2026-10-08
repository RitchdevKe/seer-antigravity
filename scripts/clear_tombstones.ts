import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🗑️ Emptying deleted_match_tombstones table on Supabase...');
  
  // To delete all rows, we can just use a filter that matches everything, e.g., not null on primary key
  const { error } = await supabase
    .from('deleted_match_tombstones')
    .delete()
    .neq('stable_id', 'impossible_id_that_never_exists'); // Deletes all rows

  if (error) {
    console.error('❌ Failed to delete tombstones:', error.message);
    process.exit(1);
  }

  console.log('✅ Successfully deleted all data in deleted_match_tombstones!');
}

main();

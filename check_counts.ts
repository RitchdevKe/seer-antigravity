import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  const { data: countData } = await supabase.from('live_matches').select('id', { count: 'exact' });
  const { data: newFmt } = await supabase.from('live_matches').select('id').like('id', '%/%');
  const { data: oldFmt } = await supabase.from('live_matches').select('id').not('id', 'like', '%/%');
  fs.writeFileSync('count_check.json', JSON.stringify({
    total: countData?.length,
    newFmt: newFmt?.length,
    oldFmt: oldFmt?.length
  }, null, 2));
  console.log("Written");
}
run();

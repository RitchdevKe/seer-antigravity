import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  const { data } = await supabase.from('live_matches').select('id, date, teams').limit(20);
  fs.writeFileSync('temp_check.json', JSON.stringify(data, null, 2));
  console.log("Done");
}
run();

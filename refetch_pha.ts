import { supabase } from './src/lib/supabase';
import * as fs from 'fs';

async function run() {
  console.log('Fetching pha_stats...');
  const { data, error } = await supabase.from('pha_stats').select('*').limit(5000);
  if (error) {
    console.error('Error fetching pha_stats:', error);
    return;
  }
  
  if (data && data.length > 0) {
    fs.writeFileSync('./supabase_backup/pha_stats.json', JSON.stringify(data, null, 2));
    console.log(`Saved ${data.length} records to pha_stats.json`);
  } else {
    console.log('No data returned.');
  }
}
run();

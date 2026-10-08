import { supabase } from './src/lib/supabase';
async function run() {
  const { data, error } = await supabase.from('nerdy_matches').select('id, data').limit(1000);
  console.log('Count:', data?.length, 'Error:', error);
}
run();

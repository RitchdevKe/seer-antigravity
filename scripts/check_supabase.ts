import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkDb() {
  const { data, error } = await supabase
    .from('ml_matrix_data')
    .select('*')
    .eq('matrix_type', 'basePatterns')
    .eq('item_key', 'SIl');
    
  console.log('Result for basePatterns_SIl:', data, error);
}

checkDb();

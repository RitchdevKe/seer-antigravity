const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('nerdy_matches').select('id, data').limit(10);
  if (data && data.length > 0) {
     console.log("First match date:", data[0].data.date);
  }
}
run().catch(console.error);

import { config } from 'dotenv';
config();
import { supabase } from '../src/lib/supabase';

async function run() {
    const { data, error } = await supabase.from('live_matches').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else if (data && data.length) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('Empty table, cannot determine schema from select.');
        // If empty, we can try to insert a fake record and let it fail to see what columns exist.
    }
    process.exit(0);
}
run();

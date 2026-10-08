import 'dotenv/config';
import { supabase } from '../src/lib/supabase';

async function run() {
    const { count, error } = await supabase.from('live_matches').select('*', { count: 'exact', head: true });
    console.log('Total matches:', count);
}
run();

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeMatrix() {
    console.log("Wiping ml_matrix_data and ml_matrix_processed_matches...");
    // Delete all rows where id is not null (which is all rows)
    const { error: e1 } = await supabase.from('ml_matrix_data').delete().neq('item_key', 'some_impossible_value_to_delete_all');
    if (e1) console.error("Error wiping ml_matrix_data:", e1);
    else console.log("Wiped ml_matrix_data");

    const { error: e2 } = await supabase.from('ml_matrix_processed_matches').delete().neq('match_id', 'some_impossible_value_to_delete_all');
    if (e2) console.error("Error wiping ml_matrix_processed_matches:", e2);
    else console.log("Wiped ml_matrix_processed_matches");
}

wipeMatrix().catch(console.error);

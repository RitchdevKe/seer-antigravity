import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    const { data, error } = await supabase
        .from('ml_matrix_data')
        .select('*')
        .like('item_key', 'SIl%')
        .order('item_key');
    
    if (error) {
        console.error("Error:", error);
    } else {
        data.forEach(row => {
            console.log(row.item_key, ":", row.total_matches);
        });
    }
}
checkDb();

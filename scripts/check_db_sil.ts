import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    const { data, error } = await supabase
        .from('ml_matrix_data')
        .select('*')
        .eq('matrix_type', 'basePatterns')
        .eq('item_key', 'SIl')
        .single();
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("DB SIl Data:", data);
    }
}
checkDb();

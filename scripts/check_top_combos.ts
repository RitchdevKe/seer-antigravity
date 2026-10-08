import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    console.log("Fetching top combos...");
    const { data: comboData, error: comboError } = await supabase
        .from('ml_matrix_data')
        .select('*')
        .eq('matrix_type', 'combos')
        .order('total_matches', { ascending: false })
        .limit(10);

    if (comboError) console.error("Combo Error:", comboError);
    else {
        console.log("Top 10 Combos:");
        comboData.forEach(row => {
            console.log("  " + row.item_key + ": " + row.total_matches + " matches");
        });
    }
}
checkDb();

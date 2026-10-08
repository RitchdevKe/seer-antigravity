import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanCombos() {
    console.log("Deleting old combos in chunks...");
    let deletedCount = 0;
    while (true) {
        const { data, error } = await supabase
            .from('ml_matrix_data')
            .select('item_key')
            .eq('matrix_type', 'combos')
            .limit(500);
            
        if (error) {
            console.error("Error fetching combos:", error);
            break;
        }
        
        if (!data || data.length === 0) {
            console.log("All combos deleted.");
            break;
        }
        
        const keys = data.map(d => d.item_key);
        const { error: delError } = await supabase
            .from('ml_matrix_data')
            .delete()
            .eq('matrix_type', 'combos')
            .in('item_key', keys);
            
        if (delError) {
            console.error("Error deleting chunk:", delError);
            break;
        }
        
        deletedCount += keys.length;
        console.log(`Deleted ${deletedCount} combos so far...`);
    }
}

cleanCombos();

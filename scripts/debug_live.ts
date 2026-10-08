import { config } from 'dotenv';
config();
import { supabase } from '../src/lib/supabase';
import fs from 'fs';

async function run() {
    const { data: dbMatches, error } = await supabase.from('live_matches').select('*');
    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }
    
    fs.writeFileSync('db_matches.json', JSON.stringify(dbMatches, null, 2));
    console.log('Saved to db_matches.json');
    process.exit(0);
}
run();

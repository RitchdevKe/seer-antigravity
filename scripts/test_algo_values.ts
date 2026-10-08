import 'dotenv/config';
import { supabase } from '../src/lib/supabase';

async function run() {
    const { data: res } = await supabase.from('live_matches').select('data').limit(20);
    for (const r of res) {
        const match = r.data;
        console.log('Algo Primary:', match.algoReport?.primaryPrediction, '| Algo Pred:', match.algoReport?.prediction);
    }
}
run();

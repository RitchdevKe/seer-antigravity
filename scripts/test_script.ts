import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import fs from 'fs';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
    const outFile = process.argv[2];
    if (!outFile) {
        console.error("Please provide output file name");
        process.exit(1);
    }
    
    // Use cached matches if available to speed up repeated runs
    let rawMatches: any[] = [];
    if (fs.existsSync('scratch/cached_matches.json')) {
        rawMatches = JSON.parse(fs.readFileSync('scratch/cached_matches.json', 'utf8'));
    } else {
        console.log("Fetching matches from Supabase...");
        const { data, error } = await supabase
            .from('uploaded_matches')
            .select('*')
            .not('results', 'is', null)
            .neq('results', '')
            .limit(3000)
            .order('date', { ascending: false });
            
        if (error) {
            console.error(error);
            return;
        }
        rawMatches = data || [];
        fs.writeFileSync('scratch/cached_matches.json', JSON.stringify(rawMatches));
    }

    console.log(`Evaluating ${rawMatches.length} matches...`);
    
    const results: any[] = [];
    
    for (const raw of rawMatches) {
        let match;
        try {
            match = typeof raw.match_data === 'string' ? JSON.parse(raw.match_data) : raw.match_data;
        } catch (e) {
            continue;
        }
        match.results = raw.results;
        
        // Predict
        const mlResult = predictWithHybridML(match);
        
        results.push({
            id: match.id || raw.id,
            results: raw.results,
            prediction: mlResult.mlPrediction,
            primary: mlResult.mlPrimaryPrediction,
            reasoning: mlResult.mlReasoning,
            source: mlResult.mlPredictionSource
        });
    }
    
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
    console.log(`Saved results to ${outFile}`);
}

run().catch(console.error);

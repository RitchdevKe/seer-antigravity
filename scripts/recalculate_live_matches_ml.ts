import { config } from 'dotenv';
config();
import { supabase } from '../src/lib/supabase';
import { Match } from '../src/types';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';

async function updateLiveML() {
    console.log("Fetching live matches...");
    const { data, error } = await supabase.from('live_matches').select('*');
    if (error) {
        console.error(error);
        return;
    }

    let updated = 0;
    console.log(`Found ${data.length} matches. Recalculating...`);

    for (const row of data) {
        let match = row.data as Match;
        if (!match) continue;
        
        const features = extractMLFeatures(match);
        if (features) {
            match.patternCode = generateSITags(features).join('+') || 'NA';
        }
        
        const ml = predictWithHybridML(match);
        if (ml && ml.mlApplied) {
            match.mlPrediction = ml.mlPrediction;
            match.mlReasoning = ml.mlReasoning;
            match.mlConfidence = ml.mlConfidence;
            match.mlStats = ml.mlStats;
        }

        const { error: upErr } = await supabase.from('live_matches')
            .update({ data: match })
            .eq('id', row.id);

        if (upErr) console.error(`Error updating ${row.id}: ${upErr.message}`);
        else updated++;
    }

    console.log(`Successfully updated ${updated} matches with new ML logic.`);
}

updateLiveML().catch(console.error);

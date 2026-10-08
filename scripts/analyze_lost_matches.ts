import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';

async function run() {
    const { data: res } = await supabase.from('live_matches')
        .select('data, result')
        .neq('result', '')
        .neq('result', '?-?')
        .neq('result', 'Unknown')
        .neq('result', 'pending')
        .limit(2000);
        
    let lostCount = 0;
    
    for (const r of res) {
        const match = r.data;
        match.result = r.result;
        const actual = getActualResult(r.result);
        
        if (!actual || actual === 'pending') continue;
        
        const mlInfo = predictWithHybridML(match);
        
        if (mlInfo.mlApplied) {
            if (!matchesPrediction(mlInfo.mlPrediction, actual)) {
                lostCount++;
                if(lostCount <= 20) {
                    console.log('LOST MATCH:', match.home_team, 'vs', match.away_team, '| Pred:', mlInfo.mlPrediction, '| Actual:', actual);
                    console.log('   Tags:', mlInfo.tags.join(', '));
                    console.log('   Matrix Stats:', JSON.stringify(mlInfo.matrixStats, null, 2));
                    console.log('--------------------------------------------------');
                }
            }
        }
    }
    console.log('Total Lost:', lostCount);
}

run();

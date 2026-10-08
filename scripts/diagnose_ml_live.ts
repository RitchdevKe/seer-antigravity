import { config } from 'dotenv';
config();
import { supabase } from '../src/lib/supabase';
import { Match } from '../src/types';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor';

async function diagnose() {
    const { data, error } = await supabase.from('live_matches').select('*').neq('result', 'Unknown').neq('result', '-');
    if (error) {
        console.error(error);
        return;
    }

    let total = 0;
    let wins = 0;
    let losses = 0;
    let pivotEngagedCount = 0;
    let pivotWins = 0;

    const lostMatches = [];

    for (const row of data) {
        const match = row.data as Match;
        if (!match) continue;
        
        match.result = row.result;

        const ml = predictWithHybridML(match);
        if (!ml || !ml.mlApplied) continue;

        total++;
        
        const isFavHome = (extractMLFeatures(match)?.favIndex === 0);
        const homeScore = parseInt(match.result.split(':')[0]);
        const awayScore = parseInt(match.result.split(':')[1]);
        
        let matchOutcome = 'X';
        if (homeScore > awayScore) matchOutcome = '1';
        if (awayScore > homeScore) matchOutcome = '2';

        const pred = ml.mlPrediction;
        let isWin = false;
        
        if (pred === '1X' && (matchOutcome === '1' || matchOutcome === 'X')) isWin = true;
        else if (pred === 'X2' && (matchOutcome === '2' || matchOutcome === 'X')) isWin = true;
        else if (pred === '12' && (matchOutcome === '1' || matchOutcome === '2')) isWin = true;
        else if (pred === '1' && matchOutcome === '1') isWin = true;
        else if (pred === '2' && matchOutcome === '2') isWin = true;
        else if (pred === 'X' && matchOutcome === 'X') isWin = true;

        if (isWin) wins++;
        else {
            losses++;
            lostMatches.push({
                teams: match.teams,
                result: match.result,
                outcome: matchOutcome,
                mlPrediction: ml.mlPrediction,
                reasoning: ml.mlReasoning,
                primarySeer: match.seerPrimaryPrediction,
                primarySubPat: match.patternAnalysis?.primaryPrediction || match.subPatternOverride?.primary,
                algoPrim: match.algoReport?.primaryPrediction
            });
        }

        if (ml.mlReasoning.includes('PIVOT TRIGGERED')) {
            pivotEngagedCount++;
            if (isWin) pivotWins++;
        }
    }

    const accuracy = ((wins / total) * 100).toFixed(2);
    
    console.log(`\n=== ML DIAGNOSTICS ===`);
    console.log(`Total Evaluated: ${total}`);
    console.log(`Wins: ${wins}, Losses: ${losses}`);
    console.log(`Accuracy: ${accuracy}%`);
    console.log(`\nPivot Engine Engaged: ${pivotEngagedCount} times`);
    console.log(`Pivot Engine Wins: ${pivotWins} / ${pivotEngagedCount}`);
    
    console.log(`\n--- LOST MATCHES ANALYSIS ---`);
    lostMatches.forEach((lm, i) => {
        console.log(`${i+1}. ${lm.teams} (Result: ${lm.result} / Outcome: ${lm.outcome})`);
        console.log(`   Prediction: ${lm.mlPrediction}`);
        console.log(`   Reasoning: ${lm.reasoning}`);
        console.log(`   Primary Signals -> Seer: ${lm.primarySeer}, SubPat: ${lm.primarySubPat}, Algo: ${lm.algoPrim}`);
    });
}

diagnose().catch(console.error);

import 'dotenv/config';
import { supabase } from '../src/lib/supabase';

function matchesPrediction(pred: string, result: string): boolean {
    if (!pred || !result) return false;
    if (pred === '1' && result === '1') return true;
    if (pred === 'X' && result === 'X') return true;
    if (pred === '2' && result === '2') return true;
    if (pred === '1X' && (result === '1' || result === 'X')) return true;
    if (pred === 'X2' && (result === 'X' || result === '2')) return true;
    if (pred === '12' && (result === '1' || result === '2')) return true;
    return false;
}

async function analyzePaaFailures() {
    const { processMatch, getActualResult } = await import('../src/utils/matchProcessing');
    const { extractMLFeatures, generateSITags } = await import('../src/utils/mlFeatureExtractor');

    const { data: completedMatches, error } = await supabase
        .from('live_matches')
        .select('*')
        .not('result', 'is', null)
        .neq('result', '');

    if (error) {
        console.error("Error fetching matches:", error);
        return;
    }

    let paaFailedTags: Record<string, number> = {};
    let paaFailedCount = 0;
    
    let paaSuccessTags: Record<string, number> = {};
    let paaSuccessCount = 0;

    for (const row of completedMatches) {
        const match = row.data;
        match.result = row.result;
        
        const processed = processMatch(match);
        const features = extractMLFeatures(processed);
        if (!features) continue;
        const tags = generateSITags(features);
        
        const paaPred = processed.paaPrediction || '1X';
        const actualResult = getActualResult(match.result || '');
        if (actualResult === 'pending') continue;
        
        if (matchesPrediction(paaPred, actualResult)) {
            paaSuccessCount++;
            tags.forEach(t => {
                paaSuccessTags[t] = (paaSuccessTags[t] || 0) + 1;
            });
        } else {
            paaFailedCount++;
            tags.forEach(t => {
                paaFailedTags[t] = (paaFailedTags[t] || 0) + 1;
            });
        }
    }

    console.log(`PAA Success: ${paaSuccessCount}, PAA Failures: ${paaFailedCount}`);
    
    // Find tags that are disproportionately present in failures
    const tagRatios: { tag: string; failRatio: number; totalOccurrences: number }[] = [];
    
    for (const tag in paaFailedTags) {
        const failCount = paaFailedTags[tag];
        const successCount = paaSuccessTags[tag] || 0;
        const total = failCount + successCount;
        
        // Only consider tags that appear a reasonable number of times
        if (total >= 10) {
            tagRatios.push({
                tag,
                failRatio: failCount / total,
                totalOccurrences: total
            });
        }
    }
    
    tagRatios.sort((a, b) => b.failRatio - a.failRatio);
    
    console.log("\nTop Tags associated with PAA FAILURES (Highest Failure Ratio):");
    tagRatios.slice(0, 15).forEach(tr => {
        console.log(`${tr.tag}: Failed ${Math.round(tr.failRatio * 100)}% of the time (Total: ${tr.totalOccurrences})`);
    });
}

analyzePaaFailures();

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { getActualResult, processMatch, matchesPrediction, getFavoriteAndUnderdog, calculatePAAPrediction } from '../src/utils/matchProcessing';
import { predictSeerDetailed, DEFAULT_WEIGHTS } from '../src/utils/seerLogic';
import { Match } from '../src/types';

// Supabase setup
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function extractToDB() {
    console.log("=========================================================================");
    console.log("🧠 EXTRACTING ML MATRIX TO SUPABASE");
    console.log("=========================================================================\n");

    const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
    if (!fs.existsSync(dataPath)) {
        console.error("❌ embedded_matches.json not found!");
        return;
    }

    console.log("Loading matches dataset...");
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const matches: any[] = JSON.parse(rawData);
    
    console.log(`Loaded ${matches.length} matches. Pre-processing for phaStatsMap...`);

    // 1. Fully process all matches first
    const fullProcessedHistory: Match[] = [];
    matches.forEach(rawMatch => {
        const matchData = rawMatch.data as Match;
        if (!matchData) return;
        const actualResult = getActualResult(matchData.result || '');
        if (actualResult === 'pending' || !actualResult) return;

        const cleanM = JSON.parse(JSON.stringify(matchData));
        delete cleanM.isPrecalculated;
        const processed = processMatch(cleanM);
        fullProcessedHistory.push(processed);
    });

    console.log(`Generated ${fullProcessedHistory.length} clean match histories. Building phaStatsMap...`);

    // 2. Build phaStatsMap
    const phaStatsMap: Record<string, any> = {};
    fullProcessedHistory.forEach(m => {
        const sub = m.patternAnalysis?.subPattern;
        if (sub) {
            if (!phaStatsMap[sub]) {
                phaStatsMap[sub] = { total: 0, paaTotal: 0, correct: 0, outcomes: { '1': 0, 'X': 0, '2': 0 }, favWin: 0, draw: 0, upsetWin: 0 };
            }
            const actual = getActualResult(m.result || '');
            if (actual !== 'pending' && actual) {
                phaStatsMap[sub].total++;
                const pred = m.finalPrediction || m.rawPrediction || '1';
                if (matchesPrediction(pred, actual)) phaStatsMap[sub].correct++;
                if (actual === '1' || actual === 'X' || actual === '2') phaStatsMap[sub].outcomes[actual]++;
                
                const favInfo = getFavoriteAndUnderdog(m);
                if (favInfo) {
                    const { fav: moFav, underdog: moUnderdog } = favInfo;
                    phaStatsMap[sub].paaTotal++;
                    if (actual === moFav) phaStatsMap[sub].favWin++;
                    else if (actual === 'X') phaStatsMap[sub].draw++;
                    else if (actual === moUnderdog) phaStatsMap[sub].upsetWin++;
                }
            }
        }
    });

    console.log("phaStatsMap generated. Running feature extraction loop...");

    // In-memory aggregation before batch upsert
    const matrix: Record<string, any> = {};
    let processedCount = 0;
    let skippedCount = 0;

    // 3. Process matches for Matrix Data
    fullProcessedHistory.forEach(processed => {
        const actualResult = getActualResult(processed.result || '');
        
        // Hydrate PAA
        if (processed.patternAnalysis?.subPattern) {
            const sub = processed.patternAnalysis.subPattern;
            if (phaStatsMap[sub] && (phaStatsMap[sub].paaTotal > 0 || phaStatsMap[sub].total > 0)) {
                const paaPred = calculatePAAPrediction(processed, phaStatsMap[sub]);
                if (paaPred) {
                    processed.paaPrimaryPrediction = paaPred.paaPrimaryPrediction;
                    processed.paaPrediction = paaPred.paaPrediction;
                }
            }
        }

        // Hydrate Seer
        const seerResult = predictSeerDetailed(processed, DEFAULT_WEIGHTS, phaStatsMap, {});
        processed.seerPrimaryPrediction = seerResult.primary;
        processed.seerPrediction = seerResult.final;

        const features = extractMLFeatures(processed);
        if (!features) {
            skippedCount++;
            return;
        }

        const isFavHome = features.favIndex === 0;
        let outcome: 'fav' | 'draw' | 'und';
        if (actualResult === 'X') outcome = 'draw';
        else if ((actualResult === '1' && isFavHome) || (actualResult === '2' && !isFavHome)) outcome = 'fav';
        else outcome = 'und';

        const tags = generateSITags(features);
        
        const updateKey = (type: string, key: string) => {
            const id = `${type}_${key}`;
            if (!matrix[id]) {
                matrix[id] = { matrix_type: type, item_key: key, total_matches: 0, fav_wins: 0, draws: 0, und_wins: 0 };
            }
            matrix[id].total_matches++;
            if (outcome === 'fav') matrix[id].fav_wins++;
            if (outcome === 'draw') matrix[id].draws++;
            if (outcome === 'und') matrix[id].und_wins++;
        };

        // SI Patterns
        if (tags && tags.length > 0) {
            tags.forEach(tag => {
                if (/^[a-zA-Z]+$/.test(tag)) {
                    updateKey('basePatterns', tag);
                } else {
                    updateKey('subPatterns', tag);
                }
            });
            
            // Sub-pattern Combinations (Pairs and Triplets)
            const subPatterns = tags.filter(t => /\d/.test(t)).sort();
            for (let i = 0; i < subPatterns.length; i++) {
                for (let j = i + 1; j < subPatterns.length; j++) {
                    for (let k = j + 1; k < subPatterns.length; k++) {
                        const triplet = subPatterns[i] + '+' + subPatterns[j] + '+' + subPatterns[k];
                        updateKey('combos', triplet);
                    }
                }
            }
        }

        // Standard Patterns
        if (features.study2_pattern) updateKey('basePatterns', features.study2_pattern);
        
        processedCount++;
    });

    console.log(`\n✅ Aggregation Complete. Processed: ${processedCount}, Skipped: ${skippedCount}`);
    
    // Filter out rare combos before pushing
    const rows = Object.values(matrix).filter(row => {
        if (row.matrix_type === 'combos' && row.total_matches < 10) return false;
        return true;
    });
    
    console.log(`Pushing ${rows.length} rows to Supabase...`);

    // Batch upsert in chunks to avoid payload size limits
    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase
            .from('ml_matrix_data')
            .upsert(chunk, { onConflict: 'matrix_type,item_key' });
            
        if (error) {
            console.error(`❌ Error inserting chunk ${i}:`, error);
        } else {
            console.log(`✅ Inserted chunk ${i} to ${i + chunk.length}`);
        }
    }

    // Also mark these matches as processed to avoid double counting later
    console.log("Pushing bookkeeping records to ml_matrix_processed_matches...");
    const processedIds = fullProcessedHistory.map(m => ({ match_id: m.id }));
        
    for (let i = 0; i < processedIds.length; i += chunkSize) {
        const chunk = processedIds.slice(i, i + chunkSize);
        const { error } = await supabase
            .from('ml_matrix_processed_matches')
            .upsert(chunk, { onConflict: 'match_id' });
        if (error) console.error(`❌ Error inserting bookkeeping chunk ${i}:`, error);
    }

    console.log("\n🎉 Extraction complete!");
}

extractToDB().catch(console.error);

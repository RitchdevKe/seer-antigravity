import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';

// Import our processing functions
import { processMatch, getFavoriteAndUnderdog, getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { getOptimalHedge } from '../src/utils/volatilityEngine';
import { Match } from '../src/types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uldhnikhpurffpfucsgn.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZGhuaWtocHVyZmZwZnVjc2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjkwOTIsImV4cCI6MjA5NjQwNTA5Mn0.OSM2MtaVqsjaJ8azAx2H2sVLIvewOQoIHC1F8zVxSPw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runLiveAnalysis() {
    console.log("Fetching matches for 2026-08-15...");
    
    // We fetch matches from Aug 15th
    const { data: matches, error } = await supabase
        .from('nerdy_matches')
        .select('*')
        .like('date', '%2026-08-15%');

    if (error) {
        console.error("Error fetching matches:", error);
        return;
    }

    console.log(`Found ${matches.length} matches.`);

    // Load ML Model
    const mlModelPath = path.resolve(process.cwd(), 'public/ml_model.json');
    let mlModelData = null;
    if (fs.existsSync(mlModelPath)) {
        mlModelData = JSON.parse(fs.readFileSync(mlModelPath, 'utf8'));
    }

    const engines: Record<string, any> = {
        'Hybrid ML': { total: 0, hits: 0, mFav: { total: 0, hits: 0 }, draw: { total: 0, hits: 0 }, underdog: { total: 0, hits: 0 }, favUnd: { total: 0, hits: 0 } },
        'Tri-Core Hybrid': { total: 0, hits: 0, mFav: { total: 0, hits: 0 }, draw: { total: 0, hits: 0 }, underdog: { total: 0, hits: 0 }, favUnd: { total: 0, hits: 0 } },
        'AI Consensus Lock': { total: 0, hits: 0, mFav: { total: 0, hits: 0 }, draw: { total: 0, hits: 0 }, underdog: { total: 0, hits: 0 }, favUnd: { total: 0, hits: 0 } },
        'Smart Override Engine': { total: 0, hits: 0, mFav: { total: 0, hits: 0 }, draw: { total: 0, hits: 0 }, underdog: { total: 0, hits: 0 }, favUnd: { total: 0, hits: 0 } },
        'Chaos Theory Engine': { total: 0, hits: 0, mFav: { total: 0, hits: 0 }, draw: { total: 0, hits: 0 }, underdog: { total: 0, hits: 0 }, favUnd: { total: 0, hits: 0 } },
        'Volatility Engine': { total: 0, hits: 0, mFav: { total: 0, hits: 0 }, draw: { total: 0, hits: 0 }, underdog: { total: 0, hits: 0 }, favUnd: { total: 0, hits: 0 } }
    };

    interface MissedFavStats {
        engine: string;
        missed: number;
        totalActualFavs: number;
    }

    const missedFavMap: Record<string, MissedFavStats> = {};

    const processPrediction = (engineName: string, pred: string, actual: string, mFav: string, mUnd: string) => {
        if (!engines[engineName]) {
            engines[engineName] = { total: 0, hits: 0, mFav: { total: 0, hits: 0 }, draw: { total: 0, hits: 0 }, underdog: { total: 0, hits: 0 }, favUnd: { total: 0, hits: 0 } };
        }
        
        if (!missedFavMap[engineName]) {
            missedFavMap[engineName] = { engine: engineName, missed: 0, totalActualFavs: 0 };
        }

        engines[engineName].total++;
        const isHit = matchesPrediction(pred, actual);
        if (isHit) engines[engineName].hits++;

        // Track missed favorites
        if (actual === mFav) {
            missedFavMap[engineName].totalActualFavs++;
            if (!isHit) {
                missedFavMap[engineName].missed++;
            }
        }

        // Categorize the prediction
        const p = pred.replace(/[^1X2]/g, '').split('').sort().join(''); // normalize

        let category = 'underdog'; // default
        if (p === 'X') {
            category = 'draw';
        } else if (p === '12') {
            category = 'favUnd';
        } else if (p.includes(mFav) && !p.includes(mUnd)) {
            category = 'mFav'; // 1 or 1X
        } else if (p.includes(mUnd)) {
            category = 'underdog'; // 2 or X2
        }

        engines[engineName][category].total++;
        if (isHit) engines[engineName][category].hits++;
    };

    let evaluatedCount = 0;

    for (const raw of matches) {
        let m: Match = { ...raw, ...(typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data) };
        if (!m || !m.result || m.result === "Unknown" || m.result === "") continue;

        const actualResult = getActualResult(m.result);
        if (!actualResult) continue;

        evaluatedCount++;

        // Get favorites
        const { fav, underdog } = getFavoriteAndUnderdog(m);
        
        // Delete isPrecalculated to force processMatch to re-calculate everything
        delete (m as any).isPrecalculated;
        
        // 1. Process the match to populate all required fields (tsa, tsb, paa, algoReport, etc.)
        const processed = processMatch(m, mlModelData);
        
        // 2. ML Engine (Which runs Pivot Engine internally based on the processed fields)
        const mlResult = predictWithHybridML(processed, mlModelData);
        if (mlResult.mlPrediction && mlResult.mlPrediction !== "Unknown" && mlResult.mlPrediction !== "NA") {
            processPrediction('Hybrid ML (Overall)', mlResult.mlPrediction, actualResult, fav, underdog);
            
            // Also break it down by the specific sub-engine that made the decision
            const pivotSource = mlResult.mlPredictionSource || 'Tri-Core Hybrid';
            processPrediction(pivotSource, mlResult.mlPrediction, actualResult, fav, underdog);
        }

        // Volatility Engine
        const volPred = getOptimalHedge(processed, {});
        if (volPred && volPred !== "Unknown" && volPred !== "NA") {
            processPrediction('Volatility Engine', volPred, actualResult, fav, underdog);
        }
    }

    console.log(`Evaluated ${evaluatedCount} matches with known results.`);
    console.log("=========================================================");
    console.log("ENGINE PERFORMANCE BREAKDOWN");
    console.log("=========================================================\n");

    let mdReport = `# Live Analysis Results (Yesterday: 2026-08-15)
*Total Evaluated Matches with Results: ${evaluatedCount}*\n\n`;

    for (const [engine, stats] of Object.entries(engines)) {
        if (stats.total === 0) continue;
        
        const accuracy = ((stats.hits / stats.total) * 100).toFixed(1);
        const mFavAcc = stats.mFav.total > 0 ? ((stats.mFav.hits / stats.mFav.total) * 100).toFixed(1) : "0.0";
        const drawAcc = stats.draw.total > 0 ? ((stats.draw.hits / stats.draw.total) * 100).toFixed(1) : "0.0";
        const undAcc = stats.underdog.total > 0 ? ((stats.underdog.hits / stats.underdog.total) * 100).toFixed(1) : "0.0";
        const favUndAcc = stats.favUnd.total > 0 ? ((stats.favUnd.hits / stats.favUnd.total) * 100).toFixed(1) : "0.0";

        console.log(`[${engine}] Overall: ${accuracy}% (${stats.hits}/${stats.total})`);
        console.log(`   -> M.Fav:    ${mFavAcc}% (${stats.mFav.hits}/${stats.mFav.total})`);
        console.log(`   -> Draw:     ${drawAcc}% (${stats.draw.hits}/${stats.draw.total})`);
        console.log(`   -> Underdog: ${undAcc}% (${stats.underdog.hits}/${stats.underdog.total})`);
        console.log(`   -> 12(Fav/U):${favUndAcc}% (${stats.favUnd.hits}/${stats.favUnd.total})\n`);

        mdReport += `## ${engine}
- **Overall Accuracy**: **${accuracy}%** (${stats.hits}/${stats.total})

**Prediction Breakdown**:
- **Market Favorite (1/1X/X1)**: ${mFavAcc}% accuracy (${stats.mFav.hits} wins / ${stats.mFav.total} predictions)
- **Draw (X)**: ${drawAcc}% accuracy (${stats.draw.hits} wins / ${stats.draw.total} predictions)
- **Underdog (2/X2/2X)**: ${undAcc}% accuracy (${stats.underdog.hits} wins / ${stats.underdog.total} predictions)
- **Fav/Und (12)**: ${favUndAcc}% accuracy (${stats.favUnd.hits} wins / ${stats.favUnd.total} predictions)

`;
    }

    mdReport += `\n=========================================================\n`;
    mdReport += `MISSED MARKET FAVORITE ANALYSIS\n`;
    mdReport += `=========================================================\n\n`;
    mdReport += `(Matches where the outcome was M.Fav, but the engine predicted something else)\n\n`;
    
    for (const [engineName, stats] of Object.entries(missedFavMap)) {
        const perc = stats.totalActualFavs > 0 ? (stats.missed / stats.totalActualFavs * 100).toFixed(1) : "0.0";
        mdReport += `[${engineName}] Missed: ${perc}% (${stats.missed}/${stats.totalActualFavs})\n`;
    }

    // Write artifact directly to the antigravity brain directory
    const outputDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    fs.writeFileSync(path.join(outputDir, 'live_analysis_results.md'), mdReport);
    console.log("Wrote artifact to live_analysis_results.md");
}

runLiveAnalysis().catch(console.error);

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LZString from 'lz-string';
import { getMatchStats } from '../src/utils/matchEvaluator';
import { Match } from '../src/types';
import { supabase } from '../src/lib/supabase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadPHAStats() {
    console.log("Loading PHA stats...");
    const { data } = await supabase.from('pattern_history_stats').select('*');
    const map: Record<string, any> = {};
    if (data) {
        data.forEach(row => {
            map[row.pattern] = row;
        });
    }
    return map;
}

import xlsx from 'xlsx';
import { predictSeerDetailed, DEFAULT_WEIGHTS } from '../src/utils/seerLogic.ts';
import { Match } from '../src/types.ts';

async function runSandbox() {
    const phaStatsMap = await loadPHAStats();

    let matches: Match[] = [];
    
    console.log("Fetching matches from live_matches...");
    const { data: liveData, error } = await supabase.from('live_matches').select('*');
    if (error) {
        console.error("Error fetching live_matches:", error);
        return;
    }
    
    const allMatches: any[] = liveData || [];
    
    // Filter matches for 2026-08-09
    matches = allMatches.map(m => m.data || m);
    
    console.log(`Loaded ${matches.length} matches from live_matches.`);

    // Qualify matches for Top 12 / best_bet (Odds 1.25 to 1.49)
    const qualifyingMatches = matches.filter(m => {
        let o1 = 0, o2 = 0;
        if (m.mo) {
            const parts = m.mo.split(/[- ,|]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
            if (parts.length >= 3) {
                o1 = parts[0];
                o2 = parts[2];
            }
        }
        (m as any)._o1 = o1;
        (m as any)._o2 = o2;
        const favOdds = o1 > 0 && o2 > 0 ? Math.min(o1, o2) : (o1 || o2);
        (m as any)._favOdds = favOdds;
        return favOdds >= 1.25 && favOdds <= 1.49;
    });

    console.log(`Found ${qualifyingMatches.length} qualifying matches for Top 12 (Odds 1.25 - 1.49).`);

    // Let's see how many actually won or drew (M.FAV or Draw)
    let favWins = 0, draws = 0, underdogWins = 0;
    
    const scoredMatches = qualifyingMatches.map(m => {
        const stats = getMatchStats(m, phaStatsMap);
        const moFav = stats.moFav;
        const moUnderdog = stats.moUnderdog;
        const favOdds = (m as any)._favOdds;
        const res = m.result.trim();
        let outcome = '';

        if (res.includes('-') || res.includes(':')) {
            const separator = res.includes('-') ? '-' : ':';
            const [h, a] = res.split(separator).map(Number);
            if (h > a) outcome = '1';
            else if (a > h) outcome = '2';
            else outcome = 'X';
        } else {
            outcome = res;
        }

        const isFavWin = outcome === moFav;
        const isDraw = outcome === 'X';
        const isUnderdogWin = outcome === moUnderdog;

        if (isFavWin) favWins++;
        if (isDraw) draws++;
        if (isUnderdogWin) underdogWins++;
        
        if (!m.algoReport || Object.keys(m.algoReport).length === 0) {
            const { percentages } = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, {});
            m.algoReport = {
                prediction: '1X',
                probabilities: {
                    '1': (percentages['1'] || 0) / 100,
                    'X': (percentages['X'] || 0) / 100,
                    '2': (percentages['2'] || 0) / 100
                }
            };
        }
        // ALGORITHM SANDBOX RANKING LOGIC
        // We need to score this match.
        // What do we have? 
        // 1. Algo ML Probabilities: m.algoReport?.probabilities
        // 2. Sub pattern PAA predictions: m.patternAnalysis?.subPatternPrediction
        
        let score = 0;
        const probs = m.algoReport?.probabilities;
        let probFav = 0;
        let probX = 0;
        let probUnd = 0;
        
        let paaFinal = '';
        if (m.patternAnalysis?.subPattern && phaStatsMap) {
            const sub = m.patternAnalysis.subPattern;
            if (phaStatsMap[sub] && (phaStatsMap[sub].paaTotal > 0 || phaStatsMap[sub].total > 0)) {
                // Approximate PAA prediction
                const s = phaStatsMap[sub];
                const winPct = (s.favWin / s.paaTotal) * 100;
                const drawPct = (s.draws / s.paaTotal) * 100;
                const upsetPct = (s.upsetWin / s.paaTotal) * 100;
                
                if (winPct >= 70) paaFinal = moFav;
                else if (winPct + drawPct >= 80) paaFinal = `${moFav}X`;
                else if (upsetPct >= 40) paaFinal = moUnderdog;
                else paaFinal = '12';
            }
        }
        
        if (probs) {
            probFav = (moFav === '1' ? probs['1'] : probs['2']);
            probUnd = (moUnderdog === '1' ? probs['1'] : probs['2']);
            probX = (probs['X'] || 0);
            
            // Normalize to 0-100 if they are 0-1
            if (probFav <= 1 && probUnd <= 1 && probX <= 1) {
                probFav *= 100;
                probUnd *= 100;
                probX *= 100;
            }
            
            // TOP 12 / BEST BET SCORING LOGIC
            
            // 1. Extreme punishment for Underdog probability
            score -= (probUnd * 3.5);
            
            // 2. High Fav Probability Boost
            if (probFav >= 75) score += 20;
            else if (probFav >= 65) score += 10;
            
            // 3. High Draw Probability is okay as long as Und is low, but Fav+Draw must be high
            const safety = probFav + probX;
            if (safety >= 90) score += 25;
            else if (safety >= 85) score += 10;
            else if (safety < 85) score -= 30; // Unsafe for Top 12
        }

        // 5. Hedged prediction
        let prediction = moFav === '1' ? '1X' : 'X2';
        
        // Final Correctness checking
        let isCorrect = false;
        if (prediction === '1X' && (outcome === '1' || outcome === 'X')) isCorrect = true;
        if (prediction === 'X2' && (outcome === '2' || outcome === 'X')) isCorrect = true;

        return {
            match: m,
            stats,
            outcome,
            prediction,
            isCorrect,
            isFavWin,
            isDraw,
            isUnderdogWin,
            score,
            probFav,
            probX,
            probUnd,
            paaFinal,
            favOdds
        };
    });

    console.log(`Pool Performance: ${favWins} M.Fav, ${draws} Draws, ${underdogWins} Underdogs.`);
    console.log(`Pool Baseline (Fav+Draw): ${(((favWins + draws) / qualifyingMatches.length) * 100).toFixed(1)}%`);

    // Rank by our new sandbox score
    scoredMatches.sort((a, b) => b.score - a.score);

    console.log(`\n--- Top 12 (best_bet) Selections ---`);
    // Top 12 category targets 12 matches
    const top12 = scoredMatches.slice(0, 12);
    
    let correct = 0;
    top12.forEach((item, index) => {
        if (item.isCorrect) correct++;
        console.log(`${index + 1}. ${item.match.teams} | Score: ${item.score.toFixed(1)} | ML Pts: ${item.match.algoReport?.scores?.['1'] || 0} | P(Fav): ${item.probFav.toFixed(1)}% P(X): ${item.probX.toFixed(1)}% | Odds Fav: ${item.favOdds} | Pred: ${item.prediction} | Outcome: ${item.outcome} | Correct: ${item.isCorrect}`);
    });

    console.log(`\nTop 12 Accuracy: ${correct}/${top12.length}`);
}

runSandbox().catch(console.error);

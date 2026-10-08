import dotenv from 'dotenv';
dotenv.config();

if (typeof global !== 'undefined') {
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

import * as fs from 'fs';
import { processMatch, getActualResult, matchesPrediction } from './src/utils/matchProcessing';
import { predictWithHybridML } from './sandboxHybrid';
import { Match } from './src/types';

async function testPivotThresholds() {
    console.log("Reading matches from backup JSON...");
    
    const fileContent = fs.readFileSync('./supabase_backup/precalculated_matches.json', 'utf-8');
    const data = JSON.parse(fileContent);
    
    const allMatches: Match[] = [];
    if (data) {
        data.forEach((row: any) => { if (row.data) allMatches.push(row.data as Match); });
    }

    // Deduplicate
    const uniqueMatchesMap = new Map<string, Match>();
    allMatches.forEach(m => {
        if (m && m.id) uniqueMatchesMap.set(m.id.toString(), m);
    });
    let matches = Array.from(uniqueMatchesMap.values()).map(m => processMatch(m));
    
    const mlModelData = JSON.parse(fs.readFileSync('./public/ml_model.json', 'utf-8'));

    const completed = matches.filter((m: any) => {
        const res = getActualResult(m.result || '');
        return res !== 'pending';
    });

    console.log(`Evaluating ${completed.length} completed matches...`);

    const stats: any = {};
    const variants = ['BASE', 'A', 'B', 'C'];
    
    variants.forEach(v => {
        stats[v] = { total: 0, correct: 0, fullPivots: 0, fullPivotsCorrect: 0, hybridPivots: 0, hybridPivotsCorrect: 0, partialPivots: 0, partialPivotsCorrect: 0 };
    });

    completed.forEach((m: any) => {
        const actual = getActualResult(m.result || '');
        
        variants.forEach(v => {
            const res = predictWithHybridML(m, mlModelData, v);
            if (res && res.mlApplied && res.mlPredictionSource === 'Pivot Engine') {
                stats[v].total++;
                if (matchesPrediction(res.mlPrediction, actual)) {
                    stats[v].correct++;
                }

                if (res.mlReasoning.includes('Full Pivot')) {
                    stats[v].fullPivots++;
                    if (matchesPrediction(res.mlPrediction, actual)) stats[v].fullPivotsCorrect++;
                } else if (res.mlReasoning.includes('Hybrid Pivot')) {
                    stats[v].hybridPivots++;
                    if (matchesPrediction(res.mlPrediction, actual)) stats[v].hybridPivotsCorrect++;
                } else if (res.mlReasoning.includes('Partial Pivot')) {
                    stats[v].partialPivots++;
                    if (matchesPrediction(res.mlPrediction, actual)) stats[v].partialPivotsCorrect++;
                }
            }
        });
    });

    function p(c: number, t: number) {
        if (t === 0) return '0%';
        return Math.round((c/t)*100) + '%';
    }

    console.log("\n--- PIVOT ENGINE THRESHOLD VARIANTS ---");
    variants.forEach(v => {
        console.log(`\nVARIANT ${v}`);
        console.log(`Overall Pivot Engine: ${stats[v].correct}/${stats[v].total} (${p(stats[v].correct, stats[v].total)})`);
        console.log(` - Full Pivots:      ${stats[v].fullPivotsCorrect}/${stats[v].fullPivots} (${p(stats[v].fullPivotsCorrect, stats[v].fullPivots)})`);
        console.log(` - Hybrid Pivots:    ${stats[v].hybridPivotsCorrect}/${stats[v].hybridPivots} (${p(stats[v].hybridPivotsCorrect, stats[v].hybridPivots)})`);
        console.log(` - Partial Pivots:   ${stats[v].partialPivotsCorrect}/${stats[v].partialPivots} (${p(stats[v].partialPivotsCorrect, stats[v].partialPivots)})`);
    });
}

testPivotThresholds().catch(console.error);

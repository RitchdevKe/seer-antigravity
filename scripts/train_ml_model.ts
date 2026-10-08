import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { getActualResult, processMatch } from '../src/utils/matchProcessing';
import { Match } from '../src/types';

// Define the outcome model types
export interface MLStats {
    total: number;
    fav: number;
    draw: number;
    und: number;
    favPct: number;
    drawPct: number;
    undPct: number;
}

export interface MLModel {
    basePatterns: Record<string, MLStats>;
    subPatterns: Record<string, MLStats>;
    combos: Record<string, MLStats>;
}

function initializeStats(): MLStats {
    return { total: 0, fav: 0, draw: 0, und: 0, favPct: 0, drawPct: 0, undPct: 0 };
}

function updateStats(stats: MLStats, outcome: 'fav' | 'draw' | 'und') {
    stats.total++;
    stats[outcome]++;
    stats.favPct = (stats.fav / stats.total) * 100;
    stats.drawPct = (stats.draw / stats.total) * 100;
    stats.undPct = (stats.und / stats.total) * 100;
}

async function trainModel() {
    console.log("=========================================================================");
    console.log("🧠 TRAINING SEER MACHINE LEARNING MODEL");
    console.log("=========================================================================\n");

    const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
    if (!fs.existsSync(dataPath)) {
        console.error("❌ embedded_matches.json not found!");
        return;
    }

    console.log("Loading matches dataset...");
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const matches: any[] = JSON.parse(rawData);
    
    console.log(`Loaded ${matches.length} matches. Extracting multi-data tag matrices...`);

    const model: MLModel = {
        basePatterns: {},
        subPatterns: {},
        combos: {}
    };

    let processedCount = 0;
    let skippedCount = 0;

    matches.forEach(rawMatch => {
        const matchData = rawMatch.data as Match;
        if (!matchData) {
            skippedCount++;
            return;
        }

        const actualResult = getActualResult(matchData.result || '');
        if (actualResult === 'pending' || !actualResult) {
            skippedCount++;
            return;
        }

        // Clean up match to re-process dynamically
        const cleanM = JSON.parse(JSON.stringify(matchData));
        delete cleanM.isPrecalculated;
        const processed = processMatch(cleanM);

        const features = extractMLFeatures(processed);
        if (!features) {
            skippedCount++;
            return;
        }

        // Determine Fav vs Und
        const isFavHome = features.favIndex === 0;
        let outcome: 'fav' | 'draw' | 'und';
        
        if (actualResult === 'X') outcome = 'draw';
        else if ((actualResult === '1' && isFavHome) || (actualResult === '2' && !isFavHome)) outcome = 'fav';
        else outcome = 'und';

        const tags = generateSITags(features);
        if (!tags || tags.length === 0) {
            skippedCount++;
            return;
        }

        // 1. Process Base Patterns and Sub Patterns
        tags.forEach(tag => {
            if (/^[a-zA-Z]+$/.test(tag)) {
                // It's a Base Pattern (e.g. 'SIa')
                if (!model.basePatterns[tag]) model.basePatterns[tag] = initializeStats();
                updateStats(model.basePatterns[tag], outcome);
            } else {
                // It's a Sub-Pattern (e.g. 'SIb1')
                if (!model.subPatterns[tag]) model.subPatterns[tag] = initializeStats();
                updateStats(model.subPatterns[tag], outcome);
            }
        });

        // 2. Process Pairs and Triplets
        const subPatterns = tags.filter(t => /\d/.test(t)).sort();
        
        // Pairs
        for (let i = 0; i < subPatterns.length; i++) {
            for (let j = i + 1; j < subPatterns.length; j++) {
                const pair = subPatterns[i] + '+' + subPatterns[j];
                if (!model.combos[pair]) model.combos[pair] = initializeStats();
                updateStats(model.combos[pair], outcome);
            }
        }
        
        // Triplets
        for (let i = 0; i < subPatterns.length; i++) {
            for (let j = i + 1; j < subPatterns.length; j++) {
                for (let k = j + 1; k < subPatterns.length; k++) {
                    const triplet = subPatterns[i] + '+' + subPatterns[j] + '+' + subPatterns[k];
                    if (!model.combos[triplet]) model.combos[triplet] = initializeStats();
                    updateStats(model.combos[triplet], outcome);
                }
            }
        }

        processedCount++;
    });

    // Clean up low-volume combos to keep the JSON light
    Object.keys(model.combos).forEach(key => {
        if (model.combos[key].total < 10) {
            delete model.combos[key];
        }
    });

    console.log(`\n✅ Training Complete.`);
    console.log(`Successfully Processed: ${processedCount}`);
    console.log(`Skipped (Pending/Invalid): ${skippedCount}`);
    console.log(`Unique Base Patterns: ${Object.keys(model.basePatterns).length}`);
    console.log(`Unique Sub-Patterns: ${Object.keys(model.subPatterns).length}`);
    console.log(`Unique Combos (Pairs & Triplets >=10): ${Object.keys(model.combos).length}`);

    const outPath = path.resolve(process.cwd(), 'public/ml_model.json');
    fs.writeFileSync(outPath, JSON.stringify(model, null, 2), 'utf-8');
    console.log(`\n💾 Saved ML Model matrix to: ${outPath}`);
}

trainModel().catch(console.error);

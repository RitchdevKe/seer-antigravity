import fs from 'fs';
import path from 'path';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { processMatch, getActualResult } from '../src/utils/matchProcessing';
import { Match } from '../src/types';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const rawData = fs.readFileSync(dataPath, 'utf-8');
const allMatchesRaw = JSON.parse(rawData);

console.log(`Loaded ${allMatchesRaw.length} matches from database.`);

// Initialize ML Models
const legacyModel: Record<string, any> = { combos: {}, subPatterns: {} };
const sandboxedModel: Record<string, any> = { combos: {}, subPatterns: {} };

function initStats() { return { total: 0, fav: 0, draw: 0, und: 0, favPct: 0, drawPct: 0, undPct: 0 }; }
function updateStats(stats: any, outcome: string) {
    stats.total++;
    stats[outcome]++;
    stats.favPct = (stats.fav / stats.total) * 100;
    stats.drawPct = (stats.draw / stats.total) * 100;
    stats.undPct = (stats.und / stats.total) * 100;
}

const validMatches: Match[] = [];
let legacyTrainingMatches = 0;

console.log("Training ML Models in Memory...");

for (const rawMatch of allMatchesRaw) {
    const matchData = rawMatch.data as Match;
    const actualResult = getActualResult(matchData.result || '');
    if (actualResult === 'pending' || !actualResult) continue;

    const cleanM = JSON.parse(JSON.stringify(matchData));
    delete cleanM.isPrecalculated;
    const processed = processMatch(cleanM);
    
    const features = extractMLFeatures(processed);
    if (!features) continue;
    
    const isFavHome = features.favIndex === 0;
    let outcome = 'und';
    if (actualResult === 'X') outcome = 'draw';
    else if ((actualResult === '1' && isFavHome) || (actualResult === '2' && !isFavHome)) outcome = 'fav';

    const tags = generateSITags(features);
    if (!tags || tags.length === 0) continue;
    
    validMatches.push(processed);

    const subPatterns = tags.filter(t => /\d/.test(t)).sort();

    subPatterns.forEach(tag => {
        if (!legacyModel.subPatterns[tag]) legacyModel.subPatterns[tag] = initStats();
        if (!sandboxedModel.subPatterns[tag]) sandboxedModel.subPatterns[tag] = initStats();
        updateStats(legacyModel.subPatterns[tag], outcome);
        updateStats(sandboxedModel.subPatterns[tag], outcome);
    });

    // Legacy Model: ONLY Triplets
    for (let i = 0; i < subPatterns.length; i++) {
        for (let j = i + 1; j < subPatterns.length; j++) {
            for (let k = j + 1; k < subPatterns.length; k++) {
                const triplet = subPatterns[i] + '+' + subPatterns[j] + '+' + subPatterns[k];
                if (!legacyModel.combos[triplet]) legacyModel.combos[triplet] = initStats();
                updateStats(legacyModel.combos[triplet], outcome);
                
                if (!sandboxedModel.combos[triplet]) sandboxedModel.combos[triplet] = initStats();
                updateStats(sandboxedModel.combos[triplet], outcome);
            }
        }
    }

    // Sandboxed Model: PAIRS
    for (let i = 0; i < subPatterns.length; i++) {
        for (let j = i + 1; j < subPatterns.length; j++) {
            const pair = subPatterns[i] + '+' + subPatterns[j];
            if (!sandboxedModel.combos[pair]) sandboxedModel.combos[pair] = initStats();
            updateStats(sandboxedModel.combos[pair], outcome);
        }
    }
}

// Clean up low volume (<10)
Object.keys(legacyModel.combos).forEach(k => { if (legacyModel.combos[k].total < 10) delete legacyModel.combos[k]; });
Object.keys(sandboxedModel.combos).forEach(k => { if (sandboxedModel.combos[k].total < 10) delete sandboxedModel.combos[k]; });

console.log(`Legacy Combos (Triplets only): ${Object.keys(legacyModel.combos).length}`);
console.log(`Sandboxed Combos (Pairs + Triplets): ${Object.keys(sandboxedModel.combos).length}`);

// ML Inference Logic Clone
function runPrediction(match: Match, features: any, tags: string[], model: any, version: 'legacy' | 'sandboxed' | 'thinking_pivot' | 'algo_pivot') {
    const isFavHome = features.favIndex === 0;
    const favWin = isFavHome ? '1' : '2';
    const undWin = isFavHome ? '2' : '1';
    const favDC = isFavHome ? '1X' : 'X2';
    const upsetDC = isFavHome ? 'X2' : '1X';
    
    const sortedTags = tags.filter(t => /\d/.test(t)).sort();
    let bestCombo = null;

    if (version === 'legacy') {
        let highestSample = 0;
        for (let i = 0; i < sortedTags.length; i++) {
            for (let j = i + 1; j < sortedTags.length; j++) {
                for (let k = j + 1; k < sortedTags.length; k++) {
                    const triplet = sortedTags[i] + '+' + sortedTags[j] + '+' + sortedTags[k];
                    const stats = model.combos[triplet];
                    if (stats && stats.total > highestSample) {
                        highestSample = stats.total;
                        bestCombo = stats;
                    }
                }
            }
        }
    } else {
        // Sandboxed & Thinking Pivot: Check Pairs & Triplets, select highest hit rate
        let bestHitRate = 0;
        let bestSample = 0;
        const allCombos = [];
        
        // Pairs
        for (let i = 0; i < sortedTags.length; i++) {
            for (let j = i + 1; j < sortedTags.length; j++) {
                const pair = sortedTags[i] + '+' + sortedTags[j];
                allCombos.push(pair);
            }
        }
        // Triplets
        for (let i = 0; i < sortedTags.length; i++) {
            for (let j = i + 1; j < sortedTags.length; j++) {
                for (let k = j + 1; k < sortedTags.length; k++) {
                    allCombos.push(sortedTags[i] + '+' + sortedTags[j] + '+' + sortedTags[k]);
                }
            }
        }
        
        for (const comboName of allCombos) {
            const stats = model.combos[comboName];
            if (stats && stats.total >= 10) {
                const maxPct = Math.max(stats.favPct, stats.drawPct, stats.undPct);
                if (maxPct > bestHitRate || (maxPct === bestHitRate && stats.total > bestSample)) {
                    bestHitRate = maxPct;
                    bestSample = stats.total;
                    bestCombo = stats;
                }
            }
        }
    }

    const subPatterns = tags.map(t => ({ tag: t, stats: model.subPatterns[t] })).filter(s => s.stats);
    
    let matrixFav = 0, matrixDraw = 0, matrixUnd = 0, sampleSize = 0;
    
    if (bestCombo && bestCombo.total >= 10) {
        matrixFav = bestCombo.favPct;
        matrixDraw = bestCombo.drawPct;
        matrixUnd = bestCombo.undPct;
        sampleSize = bestCombo.total;
    } else if (subPatterns.length > 0) {
        let tFav = 0, tDraw = 0, tUnd = 0, count = 0;
        subPatterns.forEach(sp => {
            if (sp.stats.total >= 10) {
                tFav += sp.stats.favPct;
                tDraw += sp.stats.drawPct;
                tUnd += sp.stats.undPct;
                count++;
                sampleSize += sp.stats.total;
            }
        });
        if (count > 0) {
            matrixFav = tFav / count;
            matrixDraw = tDraw / count;
            matrixUnd = tUnd / count;
        }
    }

    const algoFav = features.study5_algo?.fav ?? matrixFav;
    const seerDraw = features.study6_seer?.draw ?? matrixDraw;
    
    const rawFav = (algoFav + matrixFav) / 2;
    const rawDraw = (seerDraw + matrixDraw) / 2;
    const rawUnd = matrixUnd;
    const total = rawFav + rawDraw + rawUnd;
    
    if (total === 0) return { prediction: '', hitRate: 0, pivoted: false };
    
    const hybridFav = (rawFav / total) * 100;
    const hybridDraw = (rawDraw / total) * 100;
    const hybridUnd = (rawUnd / total) * 100;

    const paaPred = match.paaPrediction || favDC;
    const algoPred = match.algoReport?.prediction || match.algoReport?.finalPrediction || match.algoReport?.primaryPrediction || favDC;
    const seerPred = match.seerPrediction || favDC;

    let isTripleConsensus = false;
    let pivotPrediction = '';
    
    if (paaPred === algoPred && algoPred === seerPred) {
        if (matrixUnd < 35 && matrixDraw < 35) {
            isTripleConsensus = true;
            pivotPrediction = paaPred;
        }
    }

    const isVolatile = (matrixUnd >= 28 || matrixDraw >= 28) && (paaPred === favDC || paaPred === favWin);
    
    if (isVolatile && !isTripleConsensus) {
        if (version === 'thinking_pivot') {
            let pivotScore = 0;
            
            // 1. Extreme Matrix Signals (Heavy Weight)
            if (matrixUnd >= 45 || matrixDraw >= 45) {
                pivotScore += 5; // Automatic Full Pivot equivalent
            } else if (matrixUnd >= 35 || matrixDraw >= 35) {
                pivotScore += 2; // Requires at least +1 data inspection point for Partial Pivot
            }
            
            // 2. Statistical Strength (TS)
            if (features.study7_tsFavVsUnderdog !== null && features.study7_tsFavVsUnderdog < 0) {
                pivotScore += 2;
            }
            
            // 3. Form & Points Support
            if (features.study13_pointsSupport === 'Underdog') {
                pivotScore += 1;
            }
            
            // 4. Hidden Form Indicators
            if (features.study8_hiddenStrength && features.study10_hiddenWeakness) {
                pivotScore += 1;
            }
            
            // 5. Market Odds Behavior
            if (features.study1_underdogLessThanDraw) {
                pivotScore += 1;
            }

            if (pivotScore >= 5) {
                pivotPrediction = upsetDC;
            } else if (pivotScore >= 3) {
                pivotPrediction = '12';
            }
        } else if (version === 'algo_pivot') {
            let pivotScore = 0;
            
            // 1. Extreme Matrix Signals
            if (matrixUnd >= 45 || matrixDraw >= 45) {
                pivotScore += 4;
            } else if (matrixUnd >= 35 || matrixDraw >= 35) {
                pivotScore += 2;
            }
            
            // 2. Statistical Strength (TS)
            if (features.study7_tsFavVsUnderdog !== null && features.study7_tsFavVsUnderdog < 0) {
                pivotScore += 2;
            }

            // 3. Algo Disagreement (Golden Validator)
            if (matrixUnd >= 30 && (algoPred === upsetDC || algoPred === undWin || algoPred === 'X' || algoPred === '12')) {
                pivotScore += 3;
            }
            
            // 4. Market Odds Context
            const o1 = parseFloat(match.o1 || '0');
            const o2 = parseFloat(match.o2 || '0');
            const favOdds = isFavHome ? o1 : o2;
            const undOdds = isFavHome ? o2 : o1;
            
            if (matrixUnd >= 30 && favOdds > 0 && favOdds <= 1.45) {
                pivotScore += 2; // Trap detection
            }
            if (favOdds > 2.50 && undOdds > 2.50) {
                // High variance pure coin-flip
                pivotPrediction = '12';
                pivotScore = 0; // skip the score based prediction
            }

            if (pivotPrediction === '') {
                if (pivotScore >= 5) {
                    pivotPrediction = upsetDC;
                } else if (pivotScore >= 3) {
                    pivotPrediction = '12';
                }
            }
        } else {
            // Old volatility logic
            if (matrixUnd >= 45 || matrixDraw >= 45) {
                pivotPrediction = upsetDC;
            } else if (matrixUnd >= 35) {
                pivotPrediction = '12';
            }
        }
    }

    let prediction = '';
    let hitRate = 0;
    let pivoted = false;

    if (isTripleConsensus) {
        prediction = pivotPrediction;
        hitRate = 95;
    } else if (pivotPrediction !== '') {
        prediction = pivotPrediction;
        hitRate = 85; 
        pivoted = true;
    } else {
        const favDraw = hybridFav + hybridDraw;
        const favUnd = hybridFav + hybridUnd;
        const undDraw = hybridUnd + hybridDraw;
        const bestHitRate = Math.max(favDraw, favUnd, undDraw);
        if (bestHitRate === favDraw) {
            prediction = favDC;
        } else if (bestHitRate === favUnd) {
            prediction = '12';
        } else {
            prediction = upsetDC;
        }
    }

    return { prediction, pivoted, bestCombo };
}

console.log("\nEvaluating Model Effectiveness...");

let legacyCorrect = 0;
let legacyTotal = 0;
let legacyPivotCorrect = 0;
let legacyPivotTotal = 0;

let sandboxedCorrect = 0;
let sandboxedTotal = 0;
let sandboxedPivotCorrect = 0;
let sandboxedPivotTotal = 0;

let thinkingCorrect = 0;
let thinkingTotal = 0;
let thinkingPivotCorrect = 0;
let thinkingPivotTotal = 0;

let algoCorrect = 0;
let algoTotal = 0;
let algoPivotCorrect = 0;
let algoPivotTotal = 0;

function isResultCovered(prediction: string, result: string) {
    if (prediction === result) return true;
    if (prediction === '1X' && (result === '1' || result === 'X')) return true;
    if (prediction === 'X2' && (result === '2' || result === 'X')) return true;
    if (prediction === '12' && (result === '1' || result === '2')) return true;
    return false;
}

for (const match of validMatches) {
    const features = extractMLFeatures(match);
    if (!features) continue;
    const tags = generateSITags(features);
    
    const actual = getActualResult(match.result || '');
    
    // Evaluate Legacy
    const legacyRes = runPrediction(match, features, tags, legacyModel, 'legacy');
    if (legacyRes.prediction) {
        legacyTotal++;
        const correct = isResultCovered(legacyRes.prediction, actual);
        if (correct) legacyCorrect++;
        if (legacyRes.pivoted) {
            legacyPivotTotal++;
            if (correct) legacyPivotCorrect++;
        }
    }

    // Evaluate Sandboxed (Old Volatility)
    const sandboxedRes = runPrediction(match, features, tags, sandboxedModel, 'sandboxed');
    if (sandboxedRes.prediction) {
        sandboxedTotal++;
        const correct = isResultCovered(sandboxedRes.prediction, actual);
        if (correct) sandboxedCorrect++;
        if (sandboxedRes.pivoted) {
            sandboxedPivotTotal++;
            if (correct) sandboxedPivotCorrect++;
        }
    }

    // Evaluate Thinking Pivot
    const thinkingRes = runPrediction(match, features, tags, sandboxedModel, 'thinking_pivot');
    if (thinkingRes.prediction) {
        thinkingTotal++;
        const correct = isResultCovered(thinkingRes.prediction, actual);
        if (correct) thinkingCorrect++;
        if (thinkingRes.pivoted) {
            thinkingPivotTotal++;
            if (correct) thinkingPivotCorrect++;
        }
    }

    // Evaluate Algo Pivot
    const algoRes = runPrediction(match, features, tags, sandboxedModel, 'algo_pivot');
    if (algoRes.prediction) {
        algoTotal++;
        const correct = isResultCovered(algoRes.prediction, actual);
        if (correct) algoCorrect++;
        if (algoRes.pivoted) {
            algoPivotTotal++;
            if (correct) algoPivotCorrect++;
        }
    }
}

console.log(`\n============== RESULTS ==============`);
console.log(`LEGACY ML ENGINE (Triplets Only, Vol Selection):`);
console.log(`- Overall Accuracy: ${((legacyCorrect/legacyTotal)*100).toFixed(2)}% (${legacyCorrect}/${legacyTotal})`);
console.log(`- Pivot Accuracy:   ${((legacyPivotCorrect/legacyPivotTotal)*100).toFixed(2)}% (${legacyPivotCorrect}/${legacyPivotTotal})`);

console.log(`\nSANDBOXED ML ENGINE (Pairs+Triplets, Highest Hit Rate, OLD Pivot):`);
console.log(`- Overall Accuracy: ${((sandboxedCorrect/sandboxedTotal)*100).toFixed(2)}% (${sandboxedCorrect}/${sandboxedTotal})`);
console.log(`- Pivot Accuracy:   ${((sandboxedPivotCorrect/sandboxedPivotTotal)*100).toFixed(2)}% (${sandboxedPivotCorrect}/${sandboxedPivotTotal})`);

console.log(`\nTHINKING PIVOT ENGINE (Pairs+Triplets, Highest Hit Rate, Score Pivot, Vol >= 28%):`);
console.log(`- Overall Accuracy: ${((thinkingCorrect/thinkingTotal)*100).toFixed(2)}% (${thinkingCorrect}/${thinkingTotal})`);
console.log(`- Pivot Accuracy:   ${((thinkingPivotCorrect/thinkingPivotTotal)*100).toFixed(2)}% (${thinkingPivotCorrect}/${thinkingPivotTotal})`);

console.log(`\nALGO PIVOT ENGINE (Pairs+Triplets, Odds Trap, Golden Validator, Coin-flip):`);
console.log(`- Overall Accuracy: ${((algoCorrect/algoTotal)*100).toFixed(2)}% (${algoCorrect}/${algoTotal})`);
console.log(`- Pivot Accuracy:   ${((algoPivotCorrect/algoPivotTotal)*100).toFixed(2)}% (${algoPivotCorrect}/${algoPivotTotal})`);

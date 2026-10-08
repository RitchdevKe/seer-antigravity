import { Match } from './src/types';
import { runPivotEngine } from './sandboxPivotEngine';
import { extractMLFeatures, generateSITags } from './src/utils/mlFeatureExtractor';
// We use require to ensure it works in both Vite and Node scripts without JSON assertion issues.
// Note: If this fails in the browser due to pathing, we'll fetch it asynchronously. 
// However, Vite handles JSON imports perfectly.
import mlModelData from './public/ml_model.json';

const mlModel: any = mlModelData;

export interface MLPivotResult {
    mlApplied: boolean;
    mlPrediction: string;
    mlReasoning: string;
    tags: string[];
    matrixStats?: any;
    mlConfidence?: number;
    mlStats?: { hitRate: number, sampleSize: number };
    mlPrimaryPrediction?: string;
    mlPercentages?: { fav: number, draw: number, underdog: number };
    mlPredictionSource?: string;
}
/**
 * SEER MACHINE LEARNING ENGINE
 */
export function predictWithHybridML(match: Match, globalMlData?: any, variant: string = 'BASE'): MLPivotResult {
    const features = extractMLFeatures(match);
    if (!features) {
        return { mlApplied: false, mlPrediction: '', mlReasoning: 'No ML features extractable', tags: [] };
    }

    const tags = generateSITags(features);
    if (!tags || tags.length === 0) {
        return { mlApplied: false, mlPrediction: '', mlReasoning: 'No tags generated', tags: [] };
    }

    const isFavHome = features.favIndex === 0;
    const favWin = isFavHome ? '1' : '2';
    const undWin = isFavHome ? '2' : '1';
    const favDC = isFavHome ? '1X' : 'X2';
    const upsetDC = isFavHome ? 'X2' : '1X';

    const sortedTags = [...tags].sort().filter(t => /\d/.test(t));
    let bestCombo = null;

    if (globalMlData || mlModel) {
        const comboDB = (globalMlData || mlModel).combos || {};
        let bestHitRate = 0;
        let bestSample = 0;
        const allCombos = [];
        
        // Pairs
        for (let i = 0; i < sortedTags.length; i++) {
            for (let j = i + 1; j < sortedTags.length; j++) {
                allCombos.push(sortedTags[i] + '+' + sortedTags[j]);
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
            const stats = comboDB[comboName];
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

    let matrixStats = {
        exactCombo: bestCombo,
        subPatterns: tags.map((t: string) => ({ tag: t, stats: (globalMlData || mlModel).subPatterns?.[t] })).filter((s: any) => s.stats)
    };

    let matrixFav = 0;
    let matrixDraw = 0;
    let matrixUnd = 0;
    let sampleSize = 0;

    const combo = matrixStats.exactCombo;
    let useExactCombo = false;
    
    if (combo) {
        if (combo.total >= 10) {
            useExactCombo = true;
        }
    }

    if (useExactCombo) {
        matrixFav = combo.favPct;
        matrixDraw = combo.drawPct;
        matrixUnd = combo.undPct;
        sampleSize = combo.total;
    } else if (matrixStats.subPatterns.length > 0) {
        let tFav = 0, tDraw = 0, tUnd = 0, count = 0;
        matrixStats.subPatterns.forEach((sp: any) => {
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

    // Extract specialized strengths
    // Algo is excellent for Market Favorites
    const algoFav = features.study5_algo?.fav ?? matrixFav;
    // Seer is excellent for Draws
    const seerDraw = features.study6_seer?.draw ?? matrixDraw;

    // The Tri-Core Hybrid Weights
    // Blend the raw AI percentages with the newly extracted highly-accurate Matrix stats
    const rawFav = (algoFav + matrixFav) / 2;
    const rawDraw = (seerDraw + matrixDraw) / 2;
    const rawUnd = matrixUnd;

    const total = rawFav + rawDraw + rawUnd;

    if (total === 0) {
        return { 
            mlApplied: false, 
            mlPrediction: '', 
            mlReasoning: 'Insufficient data across predictors', 
            tags, 
            matrixStats 
        };
    }

    // Normalize to 100%
    let hybridFav = (rawFav / total) * 100;
    let hybridDraw = (rawDraw / total) * 100;
    let hybridUnd = (rawUnd / total) * 100;

    let primaryPrediction = '';
    if (hybridFav >= hybridDraw && hybridFav >= hybridUnd) primaryPrediction = favWin;
    else if (hybridUnd >= hybridFav && hybridUnd >= hybridDraw) primaryPrediction = undWin;
    else primaryPrediction = 'X';

    // --- NEW THEORY INJECTION (Data Preparation) ---
    const paaDraw = match.paaDraw || 0;
    const seerDrawRaw = match.seerPercentages ? match.seerPercentages['X'] : 0;
    const algoDrawRaw = match.algoReport?.probabilities?.['X'] || 0;
    const algoDraw = algoDrawRaw <= 1 ? algoDrawRaw * 100 : algoDrawRaw;
    const maxDraw = Math.max(paaDraw, seerDrawRaw, algoDraw);

    const paaFav = isFavHome ? (match.paaWin||0) : (match.paaUpset||0);
    const paaUnd = isFavHome ? (match.paaUpset||0) : (match.paaWin||0);
    const paaMax = Math.max(paaFav, paaDraw, paaUnd);

    const algoP1 = match.algoReport?.probabilities?.['1'] || 0;
    const algoP2 = match.algoReport?.probabilities?.['2'] || 0;
    const algoFavP = (algoP1 <= 1 ? algoP1 * 100 : algoP1) === 0 ? 0 : (isFavHome ? algoP1 : algoP2) * (algoP1 <= 1 ? 100 : 1);
    const algoUndP = (algoP2 <= 1 ? algoP2 * 100 : algoP2) === 0 ? 0 : (isFavHome ? algoP2 : algoP1) * (algoP2 <= 1 ? 100 : 1);
    const algoMax = Math.max(algoFavP, algoDraw, algoUndP);

    let paaPrim = match.paaPrimaryPrediction || '';
    let seerPrim = match.seerPrimaryPrediction || '';
    let algoPrim = match.algoReport?.primaryPrediction || '';
    if (!algoPrim && algoFavP > 0) {
        if (algoFavP > algoDraw && algoFavP > algoUndP) algoPrim = favWin;
        else if (algoUndP > algoFavP && algoUndP > algoDraw) algoPrim = undWin;
        else if (algoDraw > algoFavP && algoDraw > algoUndP) algoPrim = 'X';
    }
    const subPrim = match.patternAnalysis?.primaryPrediction || match.subPatternOverride?.primary || '';

    // --- PIVOT ENGINE ---
    const paaPred = match.paaPrediction || favDC;
    const algoPred = match.algoReport?.prediction || (match.algoReport as any)?.finalPrediction || (match.algoReport as any)?.primaryPrediction || favDC;
    const seerPred = match.seerPrediction || favDC;

    const pivotInput = {
        matrixUnd, matrixDraw, rawFav, rawDraw, rawUnd,
        paaPred, algoPred, seerPred,
        paaPrim, seerPrim, algoPrim, subPrim,
        favDC, upsetDC, favWin, undWin,
        hybridFav, hybridDraw, hybridUnd,
        algoMax, paaMax, maxDraw
    };

    const pivotResult = runPivotEngine(match, pivotInput, variant);

    return {
        mlApplied: true,
        mlPrediction: pivotResult.prediction,
        mlReasoning: pivotResult.reasoning,
        tags,
        matrixStats,
        mlConfidence: Math.round(pivotResult.hitRate),
        mlStats: { hitRate: Math.round(pivotResult.hitRate), sampleSize },
        mlPrimaryPrediction: pivotResult.primaryPrediction || primaryPrediction,
        mlPercentages: {
            fav: Math.round(hybridFav),
            draw: Math.round(hybridDraw),
            underdog: Math.round(hybridUnd)
        },
        mlPredictionSource: pivotResult.sourceName
    };
}

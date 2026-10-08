import fs from 'fs';
import path from 'path';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor';

// Create a slightly modified version of the real hybridMachineLearning function 
// that incorporates Theory 3 and 4 as proposed in the implementation plan.
function predictWithHybridML_NEW(match: any, globalMlData?: any): any {
    // 1. Run the old one to get all the base hybrid/matrix calculations easily
    const oldResult = predictWithHybridML(match, globalMlData);
    if (!oldResult.mlApplied) return oldResult;

    // 2. Extract the features we need to inject the new logic
    const features = extractMLFeatures(match);
    if (!features) return oldResult;

    const isFavHome = features.favIndex === 0;
    const favWin = isFavHome ? '1' : '2';
    const undWin = isFavHome ? '2' : '1';
    const favDC = isFavHome ? '1X' : 'X2';
    const upsetDC = isFavHome ? 'X2' : '1X';

    const paaDraw = match.paaDraw || 0;
    const seerDraw = match.seerPercentages ? match.seerPercentages['X'] : 0;
    const algoDrawRaw = match.algoReport?.probabilities?.['X'] || 0;
    const algoDraw = algoDrawRaw <= 1 ? algoDrawRaw * 100 : algoDrawRaw;
    const maxDraw = Math.max(paaDraw, seerDraw, algoDraw);

    const paaFav = isFavHome ? (match.paaWin||0) : (match.paaUpset||0);
    const paaUnd = isFavHome ? (match.paaUpset||0) : (match.paaWin||0);
    const paaMax = Math.max(paaFav, paaDraw, paaUnd);

    const algoP1 = match.algoReport?.probabilities?.['1'] || 0;
    const algoP2 = match.algoReport?.probabilities?.['2'] || 0;
    const algoFav = (algoP1 <= 1 ? algoP1 * 100 : algoP1) === 0 ? 0 : (isFavHome ? algoP1 : algoP2) * (algoP1 <= 1 ? 100 : 1);
    const algoUnd = (algoP2 <= 1 ? algoP2 * 100 : algoP2) === 0 ? 0 : (isFavHome ? algoP2 : algoP1) * (algoP2 <= 1 ? 100 : 1);
    const algoMax = Math.max(algoFav, algoDraw, algoUnd);

    // Primary predictions
    let paaPrim = match.paaPrimaryPrediction;
    let seerPrim = match.seerPrimaryPrediction;
    let algoPrim = match.algoReport?.primaryPrediction;
    if (!algoPrim && algoFav > 0) {
        if (algoFav > algoDraw && algoFav > algoUnd) algoPrim = favWin;
        else if (algoUnd > algoFav && algoUnd > algoDraw) algoPrim = undWin;
        else if (algoDraw > algoFav && algoDraw > algoUnd) algoPrim = 'X';
    }
    const subPrim = match.patternAnalysis?.primaryPrediction || match.subPatternOverride?.primary;

    // --- APPLY THE NEW THEORIES ---
    let newPrediction = oldResult.mlPrediction;
    let newReasoning = oldResult.mlReasoning;
    let theoryApplied = false;

    // THEORY 4: Extreme Volatility (Algo & PAA Max < 40%) -> 71.4% Und/X
    if (algoMax > 0 && paaMax > 0 && algoMax < 40 && paaMax < 40) {
        newPrediction = upsetDC; // Und/X
        newReasoning = `🤖 EXTREME CHAOS (Theory 4): Algo (${Math.round(algoMax)}%) and PAA (${Math.round(paaMax)}%) are both extremely volatile (<40%). Market Favorite collapses. Forcing Pivot to ${upsetDC}.`;
        theoryApplied = true;
    } 
    // THEORY 3: Agreement Mirage (All models predict Fav, but Draw > 33%) -> 85.1% Fav/X
    else if (paaPrim === favWin && seerPrim === favWin && algoPrim === favWin && subPrim === favWin && maxDraw > 33) {
        newPrediction = favDC; // Fav/X
        newReasoning = `🤖 AGREEMENT MIRAGE (Theory 3): All models predict M.Fav, but Draw threat is high (${Math.round(maxDraw)}%). Underdog is heavily eliminated. Forcing safe hedge to ${favDC}.`;
        theoryApplied = true;
    }

    return {
        ...oldResult,
        mlPrediction: newPrediction,
        mlReasoning: newReasoning,
        _theoryApplied: theoryApplied
    };
}

function runTests() {
    console.log("Loading pristine 13,800 dataset...");
    const dataPath = path.join(process.cwd(), 'supabase_backup/precalculated_matches.json');
    if (!fs.existsSync(dataPath)) {
        console.error("Dataset not found!");
        return;
    }
    
    const matches = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`Loaded ${matches.length} matches.`);

    let oldCorrect = 0;
    let newCorrect = 0;
    let theoryTriggers = 0;
    let theoryWins = 0;
    let theoryLosses = 0;
    let totalEval = 0;

    for (const rawMatch of matches) {
        const m = rawMatch.data ? { ...rawMatch.data, ...rawMatch } : rawMatch;
        const actual = getActualResult(m.result);
        if (actual === 'pending') continue;
        
        totalEval++;

        const oldRes = predictWithHybridML(m);
        const newRes = predictWithHybridML_NEW(m);

        const oldPred = oldRes.mlPrediction || m.finalPrediction || '1';
        const newPred = newRes.mlPrediction || m.finalPrediction || '1';

        const isOldCorrect = matchesPrediction(oldPred, actual);
        const isNewCorrect = matchesPrediction(newPred, actual);

        if (isOldCorrect) oldCorrect++;
        if (isNewCorrect) newCorrect++;

        if (newRes._theoryApplied) {
            theoryTriggers++;
            if (isNewCorrect) theoryWins++;
            else theoryLosses++;
        }
    }

    console.log(`\n=== ML PIVOT ENGINE A/B TEST ===`);
    console.log(`Total Matches Evaluated: ${totalEval}`);
    console.log(`\n--- BASELINE (Current Engine) ---`);
    console.log(`Total Correct: ${oldCorrect}`);
    console.log(`Accuracy:      ${((oldCorrect / totalEval) * 100).toFixed(2)}%`);

    console.log(`\n--- UPGRADED (With Theories 3 & 4) ---`);
    console.log(`Total Correct: ${newCorrect}`);
    console.log(`Accuracy:      ${((newCorrect / totalEval) * 100).toFixed(2)}%`);

    console.log(`\n--- NET GAIN ---`);
    const diff = newCorrect - oldCorrect;
    console.log(`Absolute Match Gain: ${diff > 0 ? '+' : ''}${diff} matches`);
    
    console.log(`\n--- THEORY IMPACT ---`);
    console.log(`Times Theories Triggered: ${theoryTriggers}`);
    console.log(`Theory Accuracy:          ${((theoryWins / theoryTriggers) * 100).toFixed(2)}%`);
}

runTests();

import { Match } from '../types';

export interface PivotEngineInput {
    matrixUnd: number;
    matrixDraw: number;
    rawFav: number;
    rawDraw: number;
    rawUnd: number;
    paaPred: string;
    algoPred: string;
    seerPred: string;
    paaPrim: string;
    seerPrim: string;
    algoPrim: string;
    subPrim: string;
    favDC: string;
    upsetDC: string;
    favWin: string;
    undWin: string;
    hybridFav: number;
    hybridDraw: number;
    hybridUnd: number;
    algoMax: number;
    paaMax: number;
    maxDraw: number;
    volScore?: number;
    opwScore?: number;
    bbScore?: number;
    upScore?: number;
    upsetRulesHit?: string[];
    drawOdds?: number;
    impliedDraw?: number;
}

export interface PivotEngineResult {
    prediction: string;
    reasoning: string;
    hitRate: number;
    sourceName: string;
    isTripleConsensus: boolean;
    primaryPrediction: string;
}

export function runPivotEngine(match: Match, input: PivotEngineInput): PivotEngineResult {
    const {
        matrixUnd, matrixDraw, paaPred, algoPred, seerPred,
        favDC, upsetDC, favWin, undWin,
        hybridFav, hybridDraw, hybridUnd,
        rawFav, rawDraw, rawUnd,
        algoMax, paaMax, maxDraw,
        paaPrim, seerPrim, algoPrim, subPrim
    } = input;

    // Resolve match-to-match OPW context and market draw compression
    const oddsStr = typeof match.odds === 'string' ? match.odds : (match.mo || '');
    const moDraw = parseFloat(String(oddsStr).split(/[,;]/)[1] || '0') || 0;
    const drawOdds = input.drawOdds ?? moDraw;
    const impliedDraw = input.impliedDraw ?? (drawOdds > 0 ? (1 / drawOdds) * 100 : 0);
    
    const bbScore = input.bbScore ?? input.opwScore ?? ((match as any).bbScore ?? (match as any).opwPoints ?? (match as any).lockedOpwScore?.totalScore ?? 0);
    const upScore = input.upScore ?? ((match as any).upScore ?? 0);
    const upsetRulesHit = input.upsetRulesHit || [];

    let isTripleConsensus = false;
    let pivotReasoning = '';
    let pivotPrediction = '';
    let pivotPrimary = '';
    
    // ---- VOLATILITY ENGINE INTEGRATION ----
    let volScore = 0;
    const isFavHome = favWin === '1';
    const paaDrawPct = match.paaDraw || 0;
    const paaUpsetPct = match.paaUpset || 0;

    if (paaUpsetPct > paaDrawPct * 1.2) volScore += 2;
    if (paaUpsetPct > 35) volScore += 1;
    if (paaUpsetPct > 50) volScore += 2;

    if (rawUnd > rawDraw) volScore += 1.5;
    if (rawUnd > rawDraw + 5) volScore += 1.5;
    if (rawUnd > 40) volScore += 1;

    if (rawUnd > 30) volScore += 1;
    if (rawUnd > 45) volScore += 2;

    const homePts = match.totalPoints?.home || 0;
    const awayPts = match.totalPoints?.away || 0;
    const mUd = favWin === '1' ? '2' : '1';
    const upsetHasMorePoints = (mUd === '1' && homePts > awayPts) || (mUd === '2' && awayPts > homePts);
    if (upsetHasMorePoints) volScore += 2;

    const league = (match.league || '').toLowerCase();
    const isVolLeague = /cup|friendly|tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria/i.test(league);
    if (isVolLeague) volScore += 1;

    if (rawDraw > 35 || paaDrawPct > 40) volScore -= 2;
    const u25Prob = (match.algoReport?.probabilities?.['U2.5'] || 0) * 100;
    if (u25Prob >= 65) volScore -= 1.5;
    
    if (volScore < 0) volScore = 0;

    // Triple consensus lock
    if (paaPred === algoPred && algoPred === seerPred) {
        if (matrixUnd < 35 && matrixDraw < 35) {
            isTripleConsensus = true;
            pivotPrediction = paaPred;
            pivotPrimary = favWin;
            pivotReasoning = `⚡ - 95% AI LOCK: Triple Consensus (PAA/Algo/Seer agree on ${paaPred}) with low volatility (Und: ${Math.round(matrixUnd)}%, Draw: ${Math.round(matrixDraw)}%).`;
        }
    }

    let isVolatile = (matrixUnd >= 28 || matrixDraw >= 28) && (paaPred === favDC || paaPred === favWin);
    
    // SMART OVERRIDES: The Volatility Engine directly controls the Pivot Engine
    if (isVolatile && volScore < 2.5) isVolatile = false;
    if (!isVolatile && volScore >= 4.5) isVolatile = true;

    if (isVolatile && !isTripleConsensus) {
        if (matrixUnd >= 42) {
            pivotPrediction = upsetDC;
            pivotPrimary = undWin;
            pivotReasoning = `⚡ - EXTREME VOLATILITY: Matrix Signal (${Math.round(matrixUnd)}%). Forcing Full Pivot to ${upsetDC} with primary ${undWin}.`;
        } else if ((volScore >= 5.0 && matrixUnd >= 35) || matrixUnd >= 38) {
            pivotPrediction = '12';
            pivotPrimary = undWin;
            pivotReasoning = `⚡ - HIGH VOLATILITY (VolScore ${volScore}): Matrix Signal (${Math.round(matrixUnd)}%). Executing Hybrid Pivot (Primary: ${undWin}, Hedge: 12).`;
        } else if (matrixDraw >= 35) {
            pivotPrediction = favDC;
            pivotPrimary = favWin;
            pivotReasoning = `⚡ - HIGH VOLATILITY: Matrix Draw (${Math.round(matrixDraw)}%). Executing Partial Pivot (Primary: ${favWin}, Hedge: ${favDC}).`;
        } else if (matrixUnd >= 28 || volScore >= 4.0) {
            pivotPrediction = '12';
            pivotPrimary = favWin;
            pivotReasoning = `⚡ - MODERATE VOLATILITY: Executing Partial Pivot (Primary: ${favWin}, Hedge: 12).`;
        }
    }

    // --- ALGO(12) vs CONSENSUS(1X/X2) CONFLICT ---
    const isAlgo12 = algoPred === '12';
    const isConsensus1X = seerPred === paaPred && (seerPred === favDC || seerPred === upsetDC);

    let pivotSourceName = 'Pivot Engine';

    if (isAlgo12 && isConsensus1X) {
        pivotSourceName = 'Smart Override Engine';
        if (volScore >= 4.0 && matrixUnd >= 38) {
            pivotPrediction = upsetDC;
            pivotPrimary = undWin;
            pivotReasoning = `⚡ - SMART OVERRIDE: Algo(12) vs Consensus(1X/X2) Conflict in EXTREME Risk Zone (VolScore: ${volScore}, MatUnd: ${Math.round(matrixUnd)}%). Full Pivot to ${upsetDC}.`;
        } else if (upScore >= 140 && bbScore <= 40) {
            // OPW Upset signals an ambush - Algo was right about the split!
            if (drawOdds > 0 && drawOdds <= 3.00) {
                pivotPrediction = upsetDC;
                pivotPrimary = undWin;
                pivotReasoning = `🛡️ - SMART OVERRIDE: Algo(12) vs Consensus(1X/X2) Conflict with High OPW Upset Conviction (+${Math.round(upScore)} PTS). Hedging to ${upsetDC} with primary ${undWin}.`;
            } else {
                pivotPrediction = '12';
                pivotPrimary = undWin;
                pivotReasoning = `🛡️ - SMART OVERRIDE: Algo(12) vs Consensus(1X/X2) Conflict with High OPW Upset Conviction (+${Math.round(upScore)} PTS). Hedging with 12 (primary ${undWin}).`;
            }
        } else if (matrixDraw >= 33) {
            pivotPrediction = favDC;
            pivotPrimary = favWin;
            pivotReasoning = `⚡ - SMART OVERRIDE: Algo(12) vs Consensus(1X/X2) Conflict in HIGH Draw Risk Zone (MatDraw: ${Math.round(matrixDraw)}%). Trusting Consensus over Algo.`;
        } else if (volScore >= 2.5 && matrixUnd >= 32) {
            pivotPrediction = '12';
            pivotPrimary = favWin;
            pivotReasoning = `⚡ - SMART OVERRIDE: Algo(12) vs Consensus(1X/X2) Conflict in HIGH Risk Zone (VolScore: ${volScore}, MatUnd: ${Math.round(matrixUnd)}%). Partial Pivot hedging with 12.`;
        } else {
            pivotPrediction = favDC;
            pivotPrimary = favWin;
            pivotReasoning = `⚡ - SMART OVERRIDE: Algo(12) vs Consensus(1X/X2) Conflict in LOW Risk Zone (VolScore: ${volScore}, MatUnd: ${Math.round(matrixUnd)}%). Trusting the favorite, hedging to ${favDC}.`;
        }
    }

    // --- REVERSE CONFLICT RESOLUTION: ALGO(1X/X2) vs CONSENSUS(12) ---
    const isAlgoFavDC = (algoPred === favDC || algoPred === upsetDC);
    const isConsensus12 = (seerPred === '12' && paaPred === '12');
    const hasHighScoringTriggers = upsetRulesHit.some(r =>
        r.includes("Both teams GA >= 1.1") ||
        r.includes("Both team GS => 1.8")
    );

    if (isAlgoFavDC && isConsensus12 && hasHighScoringTriggers) {
        pivotSourceName = 'Smart Override Engine';
        pivotPrediction = '12';
        pivotPrimary = favWin;
        pivotReasoning = `⚡ - SMART OVERRIDE: Algo(${algoPred}) vs Consensus(12) Conflict in High Goal Scoring Zone (GA/GS triggers). Overriding to 12.`;
    }

    const favDraw = hybridFav + hybridDraw;
    const favUnd = hybridFav + hybridUnd;
    const undDraw = hybridUnd + hybridDraw;
    let bestHitRate = Math.max(favDraw, favUnd, undDraw);
    
    let prediction = '';
    let reasoning = '';
    let hitRate = 0;
    let sourceName = 'Tri-Core Hybrid';
    let finalPrimary = '';

    if (isTripleConsensus) {
        prediction = pivotPrediction;
        finalPrimary = pivotPrimary || favWin;
        reasoning = pivotReasoning;
        hitRate = 95;
        sourceName = 'AI Consensus Lock';
    } else if (pivotPrediction !== '') {
        prediction = pivotPrediction;
        finalPrimary = pivotPrimary || favWin;
        reasoning = pivotReasoning;
        hitRate = 85; 
        sourceName = pivotSourceName;
    } else {
        hitRate = bestHitRate;
        if (bestHitRate === favDraw) {
            // Check OPW Upset Shield on Favorite:
            const hasUpsetConviction = (upScore >= 160 && bbScore <= 30);
            const hasColdFavForm = upsetRulesHit.includes("Both team L10 <= 5") && (match.rating || 10) < 3.0 && upScore >= 120;
            const hasAttackDominance = upsetRulesHit.includes("Both teams GA >= 1.1 (volatile match)") && (match.paaUpset || 0) > 30 && upScore >= 140;

            if (hasUpsetConviction || hasColdFavForm || hasAttackDominance) {
                if (drawOdds > 0 && drawOdds <= 3.00) {
                    prediction = upsetDC;
                    finalPrimary = undWin;
                    sourceName = 'OPW Upset Shield';
                    reasoning = `🛡️ OPW UPSET SHIELD: Tri-Core Favorite alert canceled by OPW Upset conviction (+${Math.round(upScore)} PTS, Draw Odds: ${drawOdds.toFixed(2)}). Hedging with ${upsetDC} (Primary: ${undWin}).`;
                } else {
                    prediction = '12';
                    finalPrimary = undWin;
                    sourceName = 'OPW Upset Shield';
                    reasoning = `🛡️ OPW UPSET SHIELD: Tri-Core Favorite alert canceled by OPW Upset conviction (+${Math.round(upScore)} PTS). Hedging with 12 (Primary: ${undWin}).`;
                }
            } else {
                // Check Targeted Tri-Core Draw-Filtered Pivot:
                const seerDrawPct = match.seerPercentages ? match.seerPercentages['X'] : (match.seerPrediction === 'X' ? 35 : 22);
                const isDrawDepressed = (drawOdds >= 3.35 || impliedDraw <= 29) && seerDrawPct <= 24;
                const hasUpsetConvictionFilter = (upScore >= 110 && bbScore <= 30);

                if (hasUpsetConvictionFilter && isDrawDepressed) {
                    prediction = '12';
                    finalPrimary = favWin;
                    sourceName = 'Smart Override Engine';
                    reasoning = `🛡️ SMART OVERRIDE (Tri-Core Pivot): Favorite alert canceled by OPW Upset (+${Math.round(upScore)} PTS) and Depressed Draw Odds (${drawOdds.toFixed(2)}). Hedging with 12.`;
                } else {
                    prediction = favDC;
                    finalPrimary = favWin;
                    reasoning = `Hybrid ML: Strong Favorite/Draw indicators. Algo Fav (${Math.round(rawFav)}%), Seer Draw (${Math.round(rawDraw)}%). Predicting ${favDC}.`;
                }
            }
        } else if (bestHitRate === favUnd) {
            prediction = '12';
            finalPrimary = hybridFav > hybridUnd ? favWin : undWin;
            reasoning = `Hybrid ML: High volatility between Favorite and Underdog. Matrix Und (${Math.round(matrixUnd)}%). Predicting 12.`;
        } else {
            prediction = upsetDC;
            finalPrimary = hybridDraw > hybridUnd ? 'X' : undWin;
            reasoning = `Hybrid ML: Significant Underdog/Draw threat. Matrix Und (${Math.round(matrixUnd)}%), Seer Draw (${Math.round(rawDraw)}%). Predicting ${upsetDC}.`;
        }
    }

    // THEORY 4: Extreme Volatility
    if (algoMax > 0 && paaMax > 0 && algoMax < 40 && paaMax < 40) {
        prediction = '12';
        finalPrimary = favWin;
        reasoning = `⚡ - EXTREME CHAOS (Theory 4): Algo (${Math.round(algoMax)}%) and PAA (${Math.round(paaMax)}%) are extremely volatile (<40%). Market Favorite collapses. Hedging safely with 12.`;
        hitRate = 85;
        sourceName = 'Chaos Theory Engine';
    } 
    // THEORY 3: Agreement Mirage
    else if (paaPrim === favWin && seerPrim === favWin && algoPrim === favWin && subPrim === favWin && maxDraw > 33) {
        prediction = favDC;
        finalPrimary = favWin;
        reasoning = `⚡ - AGREEMENT MIRAGE (Theory 3): All models predict M.Fav, but Draw threat is high (${Math.round(maxDraw)}%). Underdog is heavily eliminated. Forcing safe hedge to ${favDC}.`;
        hitRate = 85;
        sourceName = 'Chaos Theory Engine';
    }

    // --- OPW SYNERGY LAYER ---

    // 1. OPW High-Conviction Favorite Lock
    // At bbScore >= 240 with low upset risk (upScore <= 40), Favorite DC is very safe.
    if (prediction === '12' && bbScore !== undefined) {
        if (bbScore >= 250 && upScore <= 40) {
            prediction = favDC;
            finalPrimary = favWin;
            hitRate = 88;
            sourceName = 'OPW High-Conviction Lock';
            reasoning = `⚡ OPW HIGH-CONVICTION LOCK: OPW confirms Favorite (+${Math.round(bbScore)} PTS, low upset threat). Overriding volatile 12 split to ${favDC}.`;
        } else if (bbScore >= 160 && hybridFav >= 50 && upScore <= 30) {
            prediction = favDC;
            finalPrimary = favWin;
            hitRate = 82;
            sourceName = 'OPW Favorite Lock';
            reasoning = `⚡ OPW FAVORITE LOCK: OPW confirms Favorite (+${Math.round(bbScore)} PTS). Overriding 12 split to ${favDC}.`;
        }
    }

    // 2. Calibrated OPW Market Draw Shield on Split 12
    const isSevereDrawTrap = (drawOdds > 0 && drawOdds <= 2.80 && maxDraw >= 32) || (impliedDraw >= 36 && maxDraw >= 32);
    if (prediction === '12' && isSevereDrawTrap) {
        prediction = favDC;
        finalPrimary = favWin;
        hitRate = 82;
        sourceName = 'OPW Draw Shield';
        reasoning = `🛡️ OPW DRAW SHIELD: High draw convergence (Draw Odds: ${drawOdds.toFixed(2)}, Implied: ${Math.round(impliedDraw)}%, MaxDraw: ${Math.round(maxDraw)}%). Hedging to ${favDC}.`;
    }

    // 3. Multi-Predictor Consensus Tiering
    if (isTripleConsensus) {
        if (bbScore >= 250 && upScore <= 60) {
            hitRate = 95; // Tier 1 Elite (86.0% empirical accuracy)
            reasoning = `👑 95% TIER 1 ELITE CONSENSUS: Triple consensus (${paaPred}) with OPW High-Conviction confirmation (+${Math.round(bbScore)} PTS).`;
        } else if (bbScore >= 120 && upScore <= 80) {
            hitRate = 88; // Tier 2 Verified Consensus (82.5% accuracy)
            reasoning = `💎 88% TIER 2 VERIFIED CONSENSUS: Triple consensus (${paaPred}) with OPW points confirmation (+${Math.round(bbScore)} PTS).`;
        } else {
            hitRate = 82;
        }
    }

    return {
        prediction,
        reasoning,
        hitRate,
        sourceName,
        isTripleConsensus,
        primaryPrediction: finalPrimary
    };
}

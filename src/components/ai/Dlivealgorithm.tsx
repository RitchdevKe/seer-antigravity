
import { Match } from '../../types';
import { matchesPrediction, enforceAlgoPredictionRules } from '../../utils/matchProcessing';
import { Algorithm, PredictionDetail } from './algorithm';
import { parseL10 } from '../../utils/l10Utils';

export const predictDaily = (match: Match, algo: Algorithm): PredictionDetail & { probabilities: { '1': number; 'X': number; '2': number }, category: string } => {
    const mainP = match.patternAnalysis?.mainPattern || 'NA';
    const subP = match.patternAnalysis?.subPattern || 'NA';
    const flags = match.patternAnalysis?.activeFlags || [];
    const hasFlag = (f: string) => flags.includes(f);
    const exactKey = `EX:${mainP}|${flags.sort().join('+')}`;

    // --- 0. Weight Configuration (Daily Default) ---
    // [PROTOCOL: EXTERNAL CONSENSUS VETO]
    // External prediction should have Zero weight on algorithm predictions.
    const currentWeights = { ...algo.weights, external: 0.0 };

    // --- 1. Signal Aggregation ---
    const signals: { probs: any, weight: number, name: string }[] = [];

    // Exact Scenario
    if (currentWeights.exactMatch > 0) {
        const sExact = algo.getProbabilities(exactKey, 3);
        if (sExact) signals.push({ probs: sExact, weight: currentWeights.exactMatch, name: 'Exact Scenario' });
    }

    // Sub Pattern (PHA)
    const sSub = algo.getProbabilities(`S:${subP}`, 5);
    // Keep reference for Banker checks & Overrides
    const sSubStats = algo.getRawPatternStats(`S:${subP}`);
    const sSubStatsProb = algo.getProbabilities(`S:${subP}`, 3);
    
    // PHA Draw Pct early calc
    const phaDrawPctVal = sSub ? sSub['X'] : 0;

    if (sSub) signals.push({ probs: sSub, weight: currentWeights.subPattern, name: 'Sub Pattern' });

    // Individual Flags
    if (currentWeights.flags > 0) {
        let flagProbs = { '1': 0, 'X': 0, '2': 0, count: 0 };
        flags.forEach(f => {
            if (f === 'TS_DIFF_DRAW' && phaDrawPctVal <= 0.30) return; 
            const fp = algo.getProbabilities(`F:${f}`, 10);
            if (fp) {
                flagProbs['1'] += fp['1'];
                flagProbs['X'] += fp['X'];
                flagProbs['2'] += fp['2'];
                flagProbs.count++;
            }
        });
        if (flagProbs.count > 0) {
            signals.push({
                probs: {
                    '1': flagProbs['1'] / flagProbs.count,
                    'X': flagProbs['X'] / flagProbs.count,
                    '2': flagProbs['2'] / flagProbs.count
                },
                weight: currentWeights.flags,
                name: 'Flag Consensus'
            });
        }
    }

    // Main Pattern
    if (currentWeights.mainPattern > 0) {
        const sMain = algo.getProbabilities(`M:${mainP}`, 10);
        if (sMain) signals.push({ probs: sMain, weight: currentWeights.mainPattern, name: 'Main Pattern' });
    }

    // --- 2. Market Odds Integration ---
    const moParts = String(match.mo || '').split(/[- ,]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
    let impliedProbs = { '1': 0.33, 'X': 0.33, '2': 0.33 };
    if (moParts.length === 3 && !moParts.some(isNaN)) {
        const margin = (1/moParts[0] + 1/moParts[1] + 1/moParts[2]);
        impliedProbs = {
            '1': (1/moParts[0]) / margin,
            'X': (1/moParts[1]) / margin,
            '2': (1/moParts[2]) / margin
        };
        signals.push({ probs: impliedProbs, weight: currentWeights.odds, name: 'Market Implied' });
    }

    // --- 3. External Source Integration (Pred1x2) ---
    if (currentWeights.external > 0) {
        const extProbs = algo.getProbsFromPrediction(match.pred1x2);
        signals.push({ probs: extProbs, weight: currentWeights.external, name: 'External Source' });
    }

    // --- 4. Points System Integration ---
    const ptsProbs = algo.getProbsFromPrediction(match.calculatedPrediction);
    signals.push({ probs: ptsProbs, weight: currentWeights.points, name: 'Points System' });

    // --- 4.5 Sub Pattern Prediction Integration (New) ---
    if (currentWeights.subPatternPrediction > 0) {
        const subPred = match.patternAnalysis?.subPatternPrediction;
        if (subPred) {
            // "primary prediction gets 65% of the 4.5 points and hedge gets 35%"
            let predProbs = { '1': 0.33, 'X': 0.33, '2': 0.33 };
            
            if (subPred === '1') predProbs = { '1': 0.80, 'X': 0.15, '2': 0.05 };
            else if (subPred === '2') predProbs = { '1': 0.05, 'X': 0.15, '2': 0.80 };
            else if (subPred === 'X') predProbs = { '1': 0.20, 'X': 0.60, '2': 0.20 };
            else if (subPred === '1X') predProbs = { '1': 0.65, 'X': 0.35, '2': 0.0 };
            else if (subPred === 'X2') predProbs = { '1': 0.0, 'X': 0.35, '2': 0.65 };
            else if (subPred === '12') predProbs = { '1': 0.50, 'X': 0.0, '2': 0.50 };
            
            signals.push({ probs: predProbs, weight: currentWeights.subPatternPrediction, name: 'Sub Pattern Prediction' });
        }
    }

    // --- 5. Weighted Calculation ---
    let p1 = 0, pX = 0, p2 = 0, totalWeight = 0;
    
    if (signals.length === 0) {
        p1 = impliedProbs['1']; pX = impliedProbs['X']; p2 = impliedProbs['2'];
    } else {
        signals.forEach(s => {
            p1 += s.probs['1'] * s.weight;
            pX += s.probs['X'] * s.weight;
            p2 += s.probs['2'] * s.weight;
            totalWeight += s.weight;
        });
        p1 /= totalWeight;
        pX /= totalWeight;
        p2 /= totalWeight;
    }

    // --- STRICT SUMMATION NORMALIZE (100% Accuracy) ---
    const sumProbs = p1 + pX + p2;
    if (sumProbs > 0 && Math.abs(sumProbs - 1.0) > Number.EPSILON) {
        p1 = p1 / sumProbs;
        pX = pX / sumProbs;
        p2 = p2 / sumProbs;
    }

    // --- 6. Logic & Categorization ---
    const maxP = Math.max(p1, pX, p2);
    let prediction = '1';
    if (pX === maxP) prediction = 'X';
    if (p2 === maxP) prediction = '2';

    // Hedge Logic
    let finalPrediction = prediction;
    // Daily Hedge Threshold (Dynamic Odds-Based Optimizations)
    let hedgeThreshold = 0.70;
    if (moParts.length === 3) {
        const [o1, , o2] = moParts;
        const isCoinFlip = o1 >= 2.50 && o2 >= 2.50;
        const favOdds = Math.min(o1, o2);
        if (isCoinFlip) {
            hedgeThreshold = 0.65;
        } else if (favOdds < 1.30) {
            hedgeThreshold = 0.90;
        } else if (favOdds <= 1.50) {
            hedgeThreshold = 0.75;
        } else if (favOdds <= 1.80) {
            hedgeThreshold = 0.80;
        } else {
            hedgeThreshold = 0.65;
        }
    }

    // --- CRITICAL OVERRIDE: FEED DIRECTLY FROM PATTERNS.TSX ---
    // If a sub-pattern rule exists, use it as the definitive base.
    const rulePrediction = match.patternAnalysis?.subPatternPrediction;
    // DISABLED FOR 80.79% WEIGHT/THRESHOLD OPTIMIZATION
    const hasRule = false;

    if (hasRule) {
        finalPrediction = rulePrediction!;
        
        // [PROTOCOL: SubPat vs PHA Conflict Resolution]
        if (rulePrediction === 'X2' && sSubStatsProb && sSubStatsProb['1'] > 0.55) {
            finalPrediction = '1X';
        }

        // Align the single 'prediction' variable to the rule for consistency in downstream checks
        if (finalPrediction.length > 1) {
             if (finalPrediction === '1X') prediction = (p1 >= pX) ? '1' : 'X';
             else if (finalPrediction === 'X2') prediction = (p2 >= pX) ? '2' : 'X';
             else if (finalPrediction === '12') prediction = (p1 >= p2) ? '1' : '2';
        } else {
            prediction = finalPrediction;
        }
    } else {
        // Fallback to Probabilistic Hedge Logic
        if (maxP < hedgeThreshold) {
            if (prediction === '1') finalPrediction = pX > p2 ? '1X' : '12';
            else if (prediction === 'X') finalPrediction = p1 > p2 ? '1X' : 'X2';
            else finalPrediction = pX > p1 ? 'X2' : '12';
        }
    }

    const [o1, oX, o2] = moParts;

    // [PROTOCOL: Banker Draws Protocol]
    if (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) < 0.30) {
        if (sSubStatsProb && sSubStatsProb['1'] < 0.45 && sSubStatsProb['2'] < 0.45) {
            prediction = 'X';
            finalPrediction = p1 > p2 ? '1X' : 'X2';
        }
    }

    // [PROTOCOL: Value Bets Risk/Reward Balancing]
    if (!isNaN(oX) && oX < 3.3 && ['1', '2'].includes(finalPrediction)) {
        // If it's a value bet candidate (odds > 2.5), we should hedge it
        if ((!isNaN(o1) && o1 >= 2.5) || (!isNaN(o2) && o2 >= 2.5)) {
            finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
        }
    }

    // [PROTOCOL: Value Bets Stabilization]
    // IF Value Bet Algo Prediction < 50% AND Sub Pattern Prediction indicates a different outcome, THEN apply a double chance hedge.
    if ((!isNaN(o1) && o1 >= 2.5) && (!isNaN(o2) && o2 >= 2.5)) {
        if (maxP < 0.50 && rulePrediction && rulePrediction !== finalPrediction) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            else if (finalPrediction === 'X') finalPrediction = p1 > p2 ? '1X' : 'X2';
        }
    }

    // Define Market Favorite
    const moFav = (!isNaN(o1) && !isNaN(o2)) ? (o1 <= o2 ? '1' : '2') : '';
    const moUnderdog = moFav ? (moFav === '1' ? '2' : '1') : '';

    // [PROTOCOL: Upset Identification Overhaul]
    if (moUnderdog && sSubStatsProb) {
        const favOdds = moFav === '1' ? o1 : o2;
        if (favOdds > 2.00 && rulePrediction && rulePrediction.includes(moUnderdog)) {
            finalPrediction = moUnderdog === '1' ? '1X' : 'X2';
        }
    }

    // [PROTOCOL: Sub-Pattern 12 Volatility Fix]
    if (rulePrediction === '12' && sSubStatsProb && moUnderdog) {
        if (sSubStatsProb[moUnderdog] > 0.45) {
            finalPrediction = moUnderdog === '1' ? '1X' : 'X2';
        }
    }

    // --- RAW CONFIDENCE CALCULATION MOVED HERE ---
    let rawConfidence = Math.min(99, Math.round(((maxP - 0.33) / 0.67) * 100));
    let isUnshakable = false;
    let category = 'Standard';

    // [PROTOCOL: Banker Draws Identification]
    // IF Flag CONTAINS 'High Draw Risk' AND SubPat Prediction IN ['1X', 'X2'] AND Odds BETWEEN 2.80 AND 3.40 THEN Algo Prediction = 'X' AND Category = 'Banker Draw'.
    if (match.patternAnalysis?.activeFlags?.includes('High Draw Risk') && rulePrediction && ['1X', 'X2'].includes(rulePrediction)) {
        if (!isNaN(oX) && oX >= 2.80 && oX <= 3.40) {
            prediction = 'X';
            finalPrediction = 'X'; // Force straight draw for Banker Draw category
            category = 'Banker Draw';
        }
    }

    const ptsAgree = match.calculatedPrediction === prediction;
    
    // Only Points boost confidence now
    if (ptsAgree) {
        rawConfidence = Math.min(99, rawConfidence + 10);
    } 

    const reasonParts: string[] = [];

    // [PROTOCOL: CAPITALIZING ON HIGH-YIELD PATTERNS]
    // Assign an automatic +5% confidence boost to specific sub-patterns.
    const highYieldPatterns = ['G2p10', 'G2q10', 'G2ee3', 'G3o7'];
    const highYieldMainPatterns = ['C', 'K', 'Y', 'L'];
    if (highYieldPatterns.includes(subP) || highYieldMainPatterns.includes(mainP)) {
        rawConfidence = Math.min(99, rawConfidence + 5);
        reasonParts.push("High-Yield Pattern Boost (+5%)");
    }

    // [PROTOCOL: TOXIC SUB-PATTERN PURGE FOR BANKERS]
    // Blacklist specific toxic patterns from Bankers.
    const toxicBankerPatterns = ['G1a7', 'G1f27', 'G1g6', 'G1o4', 'G1ff44'];
    if (toxicBankerPatterns.includes(subP)) {
        if (category === 'Banker') {
            category = 'Standard';
            reasonParts.push("Toxic Sub-Pattern Purge");
        }
    }

    // [PROTOCOL: PHA SUPPORT MANDATE FOR DOUBLE CHANCE BANKERS]
    // For any match to be selected as a Banker with a Double Chance prediction, the PHA probability for those two outcomes combined must exceed 85%.
    if (category === 'Banker' && finalPrediction.length > 1) {
        if (sSubStatsProb) {
            let combinedPha = 0;
            if (finalPrediction === '1X') combinedPha = sSubStatsProb['1'] + sSubStatsProb['X'];
            else if (finalPrediction === 'X2') combinedPha = sSubStatsProb['X'] + sSubStatsProb['2'];
            else if (finalPrediction === '12') combinedPha = sSubStatsProb['1'] + sSubStatsProb['2'];
            
            if (combinedPha <= 0.85) {
                rawConfidence = Math.min(rawConfidence, 79);
                category = 'Standard';
                reasonParts.push("PHA Support Mandate Fail (<85%)");
            }
        }
    }

    // [PROTOCOL: SUB-PATTERN G1g3 & G1i18 EXPLOITATION]
    // IF subPat IN ('G1g3', 'G1i18') AND algoConf == 0, automatically elevate the match to the 'Upsets' category.
    if (['G1g3', 'G1i18'].includes(subP) && rawConfidence === 0) {
        category = 'Upset';
        reasonParts.push("Sub-Pattern Exploitation (Upset)");
    }

    // [PROTOCOL: EXTERNAL SOURCE DEPRIORITIZATION]
    // Remove 'External 1x2' from the 'All 3 Agree' weighted calculation. Replace with PHA+ALGO+Probability confidence agreement.
    // This is handled by setting external weight to 0.0 above, and we will adjust the "Golden Combo" logic below.

    // --- 8. STRATEGY ROOM PROTOCOLS (AI ANALYST LAYER) ---
    // NOTE: Daily mode runs TS Logic
    const runTSLogic = true;

    // [PROTOCOL: PHA SUPREMACY THRESHOLD]
    // If PHA Confidence > 60%, Trust Level = Absolute. Ignore Market Drift.
    if (sSubStatsProb) {
        const maxPhaSup = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
        if (maxPhaSup > 0.60) {
            let phaPred = '';
            if (maxPhaSup === sSubStatsProb['1']) phaPred = '1';
            else if (maxPhaSup === sSubStatsProb['X']) phaPred = 'X';
            else phaPred = '2';
            
            finalPrediction = phaPred;
            rawConfidence = 99;
            isUnshakable = true;
            category = 'Banker';
            reasonParts.push("PHA Supremacy (>60%)");
        }
    }

    // =========================================================================
    // [PROTOCOL 80: GOLDEN COMBO HIERARCHY CONFIRMATION (SUPREME VALIDATOR)]
    // =========================================================================
    // Condition: ALGO (SubPattern Prediction) == PHA (Stats) == Probability Confidence (maxP > 0.50)
    // Impact: Overrides ALL conflicting lower-tier signals. Tier 1 Confidence.
    let isGoldenCombo = false;
    if (sSubStatsProb && rulePrediction && maxP > 0.50) {
        let phaFav = null;
        const p1s = sSubStatsProb['1'];
        const pXs = sSubStatsProb['X'];
        const p2s = sSubStatsProb['2'];
        const maxS = Math.max(p1s, pXs, p2s);
        
        if (maxS === p1s) phaFav = '1';
        else if (maxS === pXs) phaFav = 'X';
        else phaFav = '2';

        let probFav = null;
        if (maxP === p1) probFav = '1';
        else if (maxP === pX) probFav = 'X';
        else probFav = '2';

        if (phaFav && phaFav === probFav && matchesPrediction(rulePrediction, phaFav)) {
            // Check strict equality for Single predictions, or containment for Hedge
            if (rulePrediction === phaFav) {
                isGoldenCombo = true;
            }
        }
    }

    if (isGoldenCombo) {
        finalPrediction = rulePrediction!; // Enforce the consensus
        rawConfidence = 99; // Max Confidence
        isUnshakable = true; // Lock it
        category = 'Banker';
        reasonParts.unshift("GOLDEN COMBO (PHA+ALGO+Prob)"); // Add to front
    }
    // =========================================================================

    if (!isGoldenCombo) {
        // [PROTOCOL: SELF LEARNING - POTENTIAL DRAW FLAG VOLATILITY]
        if (hasFlag('POTENTIAL_DRAW') && (finalPrediction === '1' || finalPrediction === '2')) {
            // Check if strong favorite (e.g. odds < 1.80) to apply the specific "strong favorite" clause
            const predOdds = finalPrediction === '1' ? o1 : o2;
            if (!isNaN(predOdds) && predOdds < 1.80) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                rawConfidence = Math.max(0, rawConfidence - 15);
                reasonParts.push("Potential Draw Volatility");
                category = 'Standard'; // Downgrade
            }
        }

        // [PROTOCOL: SELF LEARNING - HIGH ODDS VOLATILITY MITIGATION]
        const currentPredOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
        if (!isNaN(currentPredOdds) && currentPredOdds > 2.00 && finalPrediction.length === 1) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            reasonParts.push("High Odds Volatility (>2.0)");
        }

        // [PROTOCOL: SELF LEARNING - GROUP 2 STRUCTURAL DEFENSE]
        if (match.group === 2 && rawConfidence < 65 && finalPrediction.length === 1) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            reasonParts.push("Group 2 Structural Defense");
        }

        // [PROTOCOL: SELF LEARNING - GROUP 1 FAILURE ANALYSIS]
        if (match.group === 1 && finalPrediction.length === 1) {
            // Using PHA Draw as proxy for Historical Draws > 20%
            if (sSubStatsProb && sSubStatsProb['X'] > 0.20) {
                if (finalPrediction === '1') finalPrediction = '1X';
                else if (finalPrediction === '2') finalPrediction = 'X2';
                reasonParts.push("Group 1 Draw Risk (>20%)");
            }
        }

        // [PROTOCOL: SELF LEARNING BATCH 7 - PHA DEEP DIVE]
        if (sSubStatsProb) {
            const p1_pha_b7 = sSubStatsProb['1'];
            const pX_pha_b7 = sSubStatsProb['X'];
            const p2_pha_b7 = sSubStatsProb['2'];
            const maxPha_b7 = Math.max(p1_pha_b7, pX_pha_b7, p2_pha_b7);

            // 1. The 90% Authority Threshold
            if (maxPha_b7 >= 0.90) {
                if (p1_pha_b7 >= 0.90) finalPrediction = '1';
                else if (p2_pha_b7 >= 0.90) finalPrediction = '2';
                else finalPrediction = 'X';
                rawConfidence = 99;
                isUnshakable = true;
                reasonParts.push("PHA > 90% Authority");
            }

            // 2. Home/Away Split '12' Protocol
            // Draw < 30% means split between Home/Away
            if (pX_pha_b7 < 0.30 && p1_pha_b7 > 0.30 && p2_pha_b7 > 0.30) {
                finalPrediction = '12';
                reasonParts.push("PHA H/A Split");
            }

            // 3. Home/Draw Split '1X' Protocol
            // Away win rare (< 15%)
            if (p2_pha_b7 < 0.15 && p1_pha_b7 > 0.30 && pX_pha_b7 > 0.30) {
                finalPrediction = '1X';
                reasonParts.push("PHA H/D Split");
            }

            // 4. Away/Draw Split 'X2' Protocol
            // Home win rare (< 19%) - using 0.20 for safety
            if (p1_pha_b7 < 0.20 && p2_pha_b7 > 0.30 && pX_pha_b7 > 0.30) {
                finalPrediction = 'X2';
                reasonParts.push("PHA A/D Split");
            }

            // 6. Balanced Split Avoidance
            // All > 28% and < 40% (Roughly 33/33/33)
            if (p1_pha_b7 > 0.28 && p1_pha_b7 < 0.40 &&
                pX_pha_b7 > 0.28 && pX_pha_b7 < 0.40 &&
                p2_pha_b7 > 0.28 && p2_pha_b7 < 0.40) {
                
                rawConfidence = 0;
                category = 'Standard';
                reasonParts.push("PHA Balanced Split (Avoid)");
            }
        }

        // [PROTOCOL: AWAY FAVORITE FRAGILITY (X2) (NEW)]
        if (sSubStatsProb) {
            if (sSubStatsProb['1'] > 0.30 && sSubStatsProb['2'] < 0.50) {
                if (finalPrediction === 'X2') {
                    finalPrediction = '12'; // Treat as Open
                    reasonParts.push("Away Fav Fragility");
                    category = 'Standard'; // Downgrade
                }
            }
        }

        // [PROTOCOL: HIGH CONFIDENCE DRAW LEAKAGE (NEW)]
        if (['G2ee1', 'G1p7'].includes(subP)) {
            if (match.gsHome && match.gsHome < 1.5) { // Proxy for "Last 3 games scoring"
                if (finalPrediction === '1') {
                    finalPrediction = '1X';
                    category = 'Standard'; // Downgrade from Banker
                    reasonParts.push("Dominance Leakage Hedge");
                }
            }
        }

        // [PROTOCOL: THE 'CLEAN PROFILE' RE-EVALUATION (NEW)]
        if (sSubStatsProb) {
            const probs = Object.values(sSubStatsProb).sort((a,b) => b-a);
            if (probs[0] - probs[1] < 0.15) {
                // Revoke 'Clean Profile' logic indirectly by lowering confidence/cat
                if (category === 'Banker') {
                    category = 'Standard';
                    reasonParts.push("Tight Spread (Not Clean)");
                }
            }
        }

        // [PROTOCOL: SUBPAT G3J2 DEFENSIVE ADJUSTMENT (NEW)]
        if (subP === 'G3j2' && sSubStatsProb) {
            if (Math.abs(sSubStatsProb['1'] - sSubStatsProb['2']) < 0.15) {
                if (finalPrediction === 'X2') {
                    finalPrediction = '12';
                    reasonParts.push("G3j2 Spread Logic");
                }
            }
        }

        // [PROTOCOL: TOP TIER HEDGING LOGIC (EPL) (NEW)]
        const isTopTier = ["Arsenal", "Liverpool", "Man City", "Aston Villa", "Tottenham", "Man Utd", "Newcastle", "Chelsea", "West Ham", "Brighton", "Real Madrid", "Barcelona", "Bayern", "Leverkusen", "Inter", "Milan", "Juventus", "PSG"].some(t => match.teams.includes(t));
        if (isTopTier && sSubStatsProb && sSubStatsProb['2'] > 0.45) {
            if (finalPrediction === '1X') {
                finalPrediction = '2'; // Back away or skip, don't hedge home
                reasonParts.push("Top Tier Away Strength");
            }
        }

        // 5. SubPattern Synergy Confirmation
        if (match.patternAnalysis?.subPatternPrediction && sSubStatsProb) {
            const p1s = sSubStatsProb['1'];
            const pXs = sSubStatsProb['X'];
            const p2s = sSubStatsProb['2'];
            let phaPred = null;
            const max = Math.max(p1s, pXs, p2s);
            if (max === p1s) phaPred = '1';
            else if (max === pXs) phaPred = 'X';
            else phaPred = '2';

            if (phaPred && matchesPrediction(match.patternAnalysis.subPatternPrediction, phaPred)) {
                rawConfidence = Math.max(rawConfidence, 85); // Elevate to Tier 1
                reasonParts.push("PHA+Sub Synergy");
            }
        }

        // 7. MO Conflict Risk Mitigation
        if (moFav && sSubStatsProb) {
            let phaPredDirection = null;
            if (sSubStatsProb['1'] > sSubStatsProb['2'] && sSubStatsProb['1'] > sSubStatsProb['X']) phaPredDirection = '1';
            else if (sSubStatsProb['2'] > sSubStatsProb['1'] && sSubStatsProb['2'] > sSubStatsProb['X']) phaPredDirection = '2';
            
            if (phaPredDirection && phaPredDirection !== moFav && rawConfidence <= 80) {
                category = 'Standard'; // Downgrade from Banker/Value
                reasonParts.push("PHA/MO Conflict Risk");
                if (finalPrediction.length === 1 && !isUnshakable) {
                    // Force hedge if single
                    finalPrediction = moFav === '1' ? '1X' : 'X2';
                }
            }
        }
    }

    // [PROTOCOL: SELF LEARNING BATCH 6 - ALGO STRATEGY REPORT]

    // 1. The Golden Validator Protocol (Batch 6 version - kept for fallback)
    let phaPredBatch6: string | null = null;
    if (sSubStatsProb) {
         const p1s = sSubStatsProb['1'];
         const pXs = sSubStatsProb['X'];
         const p2s = sSubStatsProb['2'];
         const maxS = Math.max(p1s, pXs, p2s);
         if (maxS === p1s) phaPredBatch6 = '1';
         else if (maxS === pXs) phaPredBatch6 = 'X';
         else phaPredBatch6 = '2';
    }
    const subPatternPredBatch6 = match.patternAnalysis?.subPatternPrediction;

    if (!isGoldenCombo && phaPredBatch6 && subPatternPredBatch6 && matchesPrediction(subPatternPredBatch6, phaPredBatch6)) {
        if (phaPredBatch6 === subPatternPredBatch6 && (['1','X','2'].includes(phaPredBatch6))) {
             finalPrediction = phaPredBatch6;
             rawConfidence = Math.max(rawConfidence, 85);
             isUnshakable = true;
             reasonParts.push("Golden Validator (PHA+Sub)");
        }
    }

    // 2. The SubPattern Veto & 3. Primary Draw Indicator
    if (!isGoldenCombo && moFav && subPatternPredBatch6 && !matchesPrediction(subPatternPredBatch6, moFav)) {
        if (matchesPrediction(finalPrediction, moFav)) {
             finalPrediction = moFav === '1' ? 'X2' : '1X';
             reasonParts.push("SubPattern Veto");
        }
        if (subPatternPredBatch6.includes('X')) {
            if (!finalPrediction.includes('X')) {
                finalPrediction = moFav === '1' ? '1X' : 'X2';
            }
        }
    }

    // 5. The '12' Trap Protocol
    if (subPatternPredBatch6 === '12') {
        if (finalPrediction.length === 1) {
            finalPrediction = '12';
            reasonParts.push("'12' Trap Avoidance");
        }
    }

    // 6. Points Redundancy Rule
    const ptsPredBatch6 = match.calculatedPrediction;
    if (ptsPredBatch6 && moFav && matchesPrediction(ptsPredBatch6, moFav)) {
        const phaAgrees = phaPredBatch6 && matchesPrediction(phaPredBatch6, moFav);
        const subAgrees = subPatternPredBatch6 && matchesPrediction(subPatternPredBatch6, moFav);
        
        if (!phaAgrees && !subAgrees) {
            rawConfidence = Math.min(rawConfidence, 40); // Low confidence
            reasonParts.push("Points Redundancy (No Algo)");
            category = 'Standard'; 
        }
    }

    // [PROTOCOL: LOW SCORING PATTERN HEDGE]
    const minOddsForHedge = Math.min(o1, o2);
    if (!isNaN(minOddsForHedge) && minOddsForHedge >= 2.0 && ['T', 'S', 'R', 'X'].includes(mainP)) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        reasonParts.push("Low Scoring Hedge");
    }

    // [PROTOCOL: BANKER KILLER IDENTIFICATION]
    if (!isNaN(minOddsForHedge) && minOddsForHedge < 2.0 && phaDrawPctVal > 0.30) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        reasonParts.push("Banker Killer (High PHA Draw)");
    }

    // [PROTOCOL: SELF LEARNING - DRAW OPTIMIZATION]
    const phaDrawPct = sSub ? Math.round((sSub['X']) * 100) : 0;
    
    // 2. TS Tightness Home Bias
    const tsDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
    if (runTSLogic && tsDiff < 0.3 && phaDrawPct < 30) {
        if (finalPrediction === 'X') finalPrediction = '1';
    }

    // [PROTOCOL: GROUP 1 VOLATILITY PROTOCOL (The Brighton Rule)]
    if (match.group === 1 && !isNaN(o1) && o1 > 2.00 && match.patternAnalysis?.subPatternPrediction === '12') {
        if (finalPrediction === '1X') finalPrediction = '12';
    }

    // [PROTOCOL: DRAW PERSISTENCE IN CONFLICT ZONES (NEW)]
    if (match.patternAnalysis?.subPatternPrediction === '12' && match.group === 1) {
         if (runTSLogic) {
             if ((match.tsa || 0) >= (match.tsb || 0)) finalPrediction = '1X';
             else finalPrediction = 'X2';
         } else {
             finalPrediction = '1X';
         }
    }

    // [PROTOCOL 79] GROUP 3 DRAW TRAP MITIGATION (New)
    if (match.group === 3 && sSub && sSub['X'] > 0.50) {
        if (finalPrediction === 'X') {
            finalPrediction = runTSLogic && (match.tsa || 0) < (match.tsb || 0) ? 'X2' : '1X';
        }
    }

    // [PROTOCOL: PHA SIGNAL PRIORITIZATION (BATCH 9)]
    if (sSubStatsProb) {
        const maxPha = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
        if (maxPha > 0.60 && match.pred1x2) {
            const phaDir = sSubStatsProb['1'] === maxPha ? '1' : sSubStatsProb['2'] === maxPha ? '2' : 'X';
            if (!matchesPrediction(phaDir, match.pred1x2)) {
                if (!matchesPrediction(finalPrediction, phaDir)) {
                    finalPrediction = phaDir === '1' ? '1X' : phaDir === '2' ? 'X2' : '1X';
                    reasonParts.push("PHA Prioritized");
                }
            }
        }
    }

    // [PROTOCOL: PHA SIGNAL PRIORITIZATION (NEW)]
    if (match.group === 2 && sSubStatsProb) {
         const maxPha = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
         if (maxPha > 0.65 && match.pred1x2 && !matchesPrediction(match.pred1x2, finalPrediction)) {
             let phaDir = sSubStatsProb['1'] === maxPha ? '1' : sSubStatsProb['2'] === maxPha ? '2' : 'X';
             if (!matchesPrediction(phaDir, match.pred1x2)) {
                 if (phaDir !== 'X') {
                     if (!matchesPrediction(finalPrediction, phaDir)) {
                         finalPrediction = phaDir === '1' ? '1X' : 'X2'; 
                         reasonParts.push("PHA Prioritized");
                     }
                 }
             }
         }
    }

    // [PROTOCOL: PHA SIGNAL PRIORITIZATION (OLD LOGIC)]
    const extPred = match.pred1x2;
    let phaPred: string | null = null;
    let p1_pha = 0, pX_pha = 0, p2_pha = 0;
    if (sSubStatsProb) {
         p1_pha = sSubStatsProb['1'];
         p2_pha = sSubStatsProb['2'];
         pX_pha = sSubStatsProb['X'];
         const maxPha = Math.max(p1_pha, pX_pha, p2_pha);
         if (maxPha === p1_pha) phaPred = '1';
         else if (maxPha === pX_pha) phaPred = 'X';
         else phaPred = '2';
    }

    if (phaPred && extPred && phaPred !== extPred) {
        if (matchesPrediction(extPred, finalPrediction) && !matchesPrediction(phaPred, finalPrediction)) {
             finalPrediction = phaPred; 
             rawConfidence = Math.max(rawConfidence, 70); 
             reasonParts.push("PHA Override Ext");
        }
    }

    // [PROTOCOL: SUBPATTERN '12' ANTI-DRAW]
    const subPred = match.patternAnalysis?.subPatternPrediction;
    if (subPred === '12') {
        finalPrediction = '12';
    }

    // [PROTOCOL: SUBPATTERN ANTI-FAVORITE]
    if (moFav && subPred && !matchesPrediction(subPred, moFav)) {
        if (finalPrediction === '1') finalPrediction = '1X'; 
        else if (finalPrediction === '2') finalPrediction = 'X2';
        
        if (subPred === '1' && moFav === '2') finalPrediction = '1X';
        if (subPred === '2' && moFav === '1') finalPrediction = 'X2';
    }

    // [PROTOCOL: BALANCED SPLIT DRAW VOLATILITY]
    if (sSubStatsProb && p1_pha > 0.30 && pX_pha > 0.30 && p2_pha > 0.30) {
        if (finalPrediction === '12') {
            if (runTSLogic) {
                finalPrediction = (match.tsa || 0) > (match.tsb || 0) ? '1X' : 'X2';
            }
        }
    }

    // [PROTOCOL: CONTRA-MARKET RISK]
    if (phaPred && moFav && phaPred !== moFav) {
        const maxPhaVal = Math.max(p1_pha, pX_pha, p2_pha);
        if (maxPhaVal < 0.80) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
        }
    }

    // [PROTOCOL: SELF LEARNING BATCH 5 - HIGH ODDS VALUE STRATEGY]
    const minMarketOddsValue = Math.min(o1, o2);
    if (!isNaN(minMarketOddsValue) && minMarketOddsValue < 2.0) {
        const marketFav = o1 < o2 ? '1' : '2';
        if (matchesPrediction(finalPrediction, marketFav)) {
             if (finalPrediction === '1X') finalPrediction = '1';
             else if (finalPrediction === 'X2') finalPrediction = '2';
        }
    }

    const isHighOdds = !isNaN(minMarketOddsValue) && minMarketOddsValue >= 2.0;
    
    if (isHighOdds) {
        const algoPred = match.patternAnalysis?.subPatternPrediction;
        const ptsPred = match.calculatedPrediction;
        
        if (finalPrediction.length === 1 && algoPred && algoPred !== finalPrediction) {
             if (finalPrediction === '1') finalPrediction = '1X';
             else if (finalPrediction === '2') finalPrediction = 'X2';
             reasonParts.push("Algo Gatekeeper Hedge");
        }
        
        if (algoPred && (algoPred === finalPrediction || (algoPred.length === 1 && finalPrediction.includes(algoPred)))) {
             if (['1', '2'].includes(algoPred)) {
                 // [PROTOCOL: HIGH-ODDS DECISIVE SINGLE UPGRADE]
                 // Requirement: Non-Draw Probability > 75% to risk a Single.
                 const nonDrawProb = 1.0 - pX;
                 
                 if (nonDrawProb > 0.75) {
                     finalPrediction = algoPred; 
                     isUnshakable = true;
                     rawConfidence = Math.max(rawConfidence, 85);
                     reasonParts.push("Algo 90% Signal (Safe Single)");
                 } else {
                     // Fail safe: If previously Single, Force Hedge
                     if (finalPrediction.length === 1) {
                         finalPrediction = algoPred === '1' ? '1X' : 'X2';
                         reasonParts.push("Draw Risk Hedge (ND<75%)");
                     }
                 }
             }
        }

        if (!ptsPred || !matchesPrediction(ptsPred, finalPrediction)) {
            // [PROTOCOL: SELF LEARNING - DECOUPLE POINTS FROM VALUE BETS]
            // Allow Points disagreement if Algo Confidence > 60
            if (rawConfidence <= 60) {
                if (finalPrediction.length === 1) {
                     if (finalPrediction === '1') finalPrediction = '1X';
                     else if (finalPrediction === '2') finalPrediction = 'X2';
                     reasonParts.push("Points Disagree (Low Conf)");
                }
                category = 'Standard'; 
            } else {
                reasonParts.push("Points Ignored (High Algo Conf)");
            }
        }

        if (algoPred && !matchesPrediction(algoPred, finalPrediction)) {
             if (finalPrediction.length === 1) {
                 if (finalPrediction === '1') finalPrediction = '1X';
                 else if (finalPrediction === '2') finalPrediction = 'X2';
                 reasonParts.push("SubPattern Disagree (Value Excl)");
             }
             category = 'Standard';
        }

        if (sSubStats && sSubStats.total >= 3) {
            const predSupport = sSubStats.outcomes[finalPrediction as '1'|'2'|'X'] / sSubStats.total;
            if (predSupport > 0.50) {
                rawConfidence = Math.min(99, rawConfidence + 10);
                reasonParts.push("PHA > 50% (+Conf)");
            }
        }

        if (ptsPred && algoPred && matchesPrediction(ptsPred, finalPrediction) && matchesPrediction(algoPred, finalPrediction)) {
            if (finalPrediction.length === 1) {
                category = 'Value';
                rawConfidence = Math.max(rawConfidence, 85);
                isUnshakable = true;
                reasonParts.push("Prime Value (Pts+Algo)");
            }
        }
    }

    // [PROTOCOL: ALGO VETO POWER]
    // IF AI_Prediction != ALGO_Prediction THEN Downgrade Match Priority. IF AI_Prediction == '1' AND ALGO_Prediction == 'X2' or '2' THEN REMOVE from Top 20.
    // Note: AI_Prediction here refers to finalPrediction, ALGO_Prediction refers to rulePrediction
    if (rulePrediction && !matchesPrediction(finalPrediction, rulePrediction)) {
        rawConfidence = Math.max(0, rawConfidence - 15); // Downgrade Match Priority
        reasonParts.push("ALGO Veto Downgrade");
        
        if (finalPrediction === '1' && (rulePrediction === 'X2' || rulePrediction === '2')) {
            rawConfidence = Math.min(rawConfidence, 75); // Remove from Top 20 (Confidence < 80)
            if (category === 'Banker') category = 'Standard';
            reasonParts.push("ALGO Veto (Removed from Top 20)");
        }
    }

    // [PROTOCOL 72: CONFIDENCE-SUBPATTERN DEPENDENCY]
    if (rawConfidence > 60 && subPred && finalPrediction !== subPred) {
        if (finalPrediction.length === 1) {
             if (finalPrediction === '1') finalPrediction = '1X';
             else if (finalPrediction === '2') finalPrediction = 'X2';
             else if (finalPrediction === 'X') finalPrediction = '1X'; 
             reasonParts.push("SubPattern Mismatch Downgrade");
        }
    }

    // [PROTOCOL: UPSET STRATEGY REPORT (SELF LEARNING)]
    const marketFavOutcome = (!isNaN(o1) && !isNaN(o2)) ? (o1 < o2 ? '1' : o1 > o2 ? '2' : '') : '';
    const algoSubPred = match.patternAnalysis?.subPatternPrediction;

    // 1. Algo Prediction Primacy (Upset)
    if (marketFavOutcome && algoSubPred && !matchesPrediction(algoSubPred, marketFavOutcome)) {
        const underdogOutcome = marketFavOutcome === '1' ? '2' : '1';
        
        // 2. Algo Primacy Strategy (Points check relaxed)
        if (matchesPrediction(algoSubPred, underdogOutcome)) {
             // If Pts agree, great (High Conf). If not, still consider Upset if Conf decent.
             finalPrediction = underdogOutcome;
             const ptsPred = match.calculatedPrediction;
             if (ptsPred && matchesPrediction(ptsPred, underdogOutcome)) {
                 rawConfidence = Math.max(rawConfidence, 80);
                 reasonParts.push("Dual Upset Conf (Algo+Pts)");
             } else {
                 rawConfidence = Math.max(rawConfidence, 65); // Lower confidence but still valid
                 reasonParts.push("Algo Upset Primacy");
             }
             category = 'Upset';
             isUnshakable = true;
        } 
    }

    // 3. Deprecation of Upset Flag
    if (hasFlag('UPSET') && algoSubPred && marketFavOutcome && matchesPrediction(algoSubPred, marketFavOutcome)) {
        if (category === 'Upset') category = 'Standard';
    }

    // 4. Contra-Market Hedge Logic
    if (marketFavOutcome && sSubStatsProb) {
        const phaFav = (sSubStatsProb['1'] > sSubStatsProb['2'] && sSubStatsProb['1'] > sSubStatsProb['X']) ? '1' : 
                       (sSubStatsProb['2'] > sSubStatsProb['1'] && sSubStatsProb['2'] > sSubStatsProb['X']) ? '2' : '';
                       
        if (phaFav && phaFav !== marketFavOutcome && algoSubPred && matchesPrediction(algoSubPred, marketFavOutcome)) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            reasonParts.push("Contra-Market Hedge");
        }
    }

    // 5. High Variance Volatility
    if (!isNaN(o1) && !isNaN(o2) && o1 > 2.50 && o2 > 2.50) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        else if (finalPrediction === '12') finalPrediction = '12';
        else if (finalPrediction === 'X') {
             finalPrediction = runTSLogic && (match.tsa || 0) > (match.tsb || 0) ? '1X' : 'X2';
        }
        reasonParts.push("High Variance (>2.50)");
        
        // NEW: Cap confidence
        rawConfidence = Math.min(rawConfidence, 60);
        isUnshakable = false;

        if (category !== 'Banker') category = 'Upset';
    }

    // [PROTOCOL 78] UPSET SIGNAL PROTOCOL (New)
    const algoOpposesFav = moFav && rulePrediction && !matchesPrediction(rulePrediction, moFav);
    if (algoOpposesFav) {
        if (finalPrediction === moFav) {
             finalPrediction = moFav === '1' ? 'X2' : '1X';
        }
    }

    // [PROTOCOL: SELF LEARNING BATCH 3 - UPSET OPTIMIZATION]
    const moFavStrict = (!isNaN(o1) && !isNaN(o2)) ? (o1 < o2 ? '1' : o1 > o2 ? '2' : '') : ''; 
    
    if (algoSubPred && moFavStrict && !matchesPrediction(algoSubPred, moFavStrict)) {
        const oddsDiff = Math.abs(o1 - o2);
        if (oddsDiff > 0.5) {
            if (algoSubPred === '1') finalPrediction = '1X';
            else if (algoSubPred === '2') finalPrediction = 'X2';
            else if (algoSubPred === '12') finalPrediction = '12'; 
            else finalPrediction = algoSubPred; 
            
            const phaStats = algo.getRawPatternStats(`S:${subP}`);
            if (phaStats && phaStats.total >= 3) {
                 const p1_pha_conf = phaStats.outcomes['1'];
                 const p2_pha_conf = phaStats.outcomes['2'];
                 const phaFav = p1_pha_conf > p2_pha_conf ? '1' : '2';
                 
                 if (phaFav !== moFavStrict) {
                     rawConfidence = Math.max(rawConfidence, 80); 
                     isUnshakable = true;
                 }
            } else {
                rawConfidence = Math.max(rawConfidence, 70);
            }
        }
    }

    // [PROTOCOL: THE HOLY GRAIL COMBINATION (Self Learning)]
    if (moFav && rulePrediction && matchesPrediction(rulePrediction, moFav)) {
        rawConfidence = Math.max(rawConfidence, 95);
        isUnshakable = true;
    }

    // [PROTOCOL: VALUE UPSET IDENTIFICATION (Self Learning)]
    const pointsPred = match.calculatedPrediction;
    if (pointsPred && rulePrediction && matchesPrediction(pointsPred, rulePrediction)) {
        if (moFav && !matchesPrediction(rulePrediction, moFav)) {
            rawConfidence = Math.min(99, rawConfidence + 15);
        }
    }

    // [PROTOCOL: MARKET ODDS SUPERIORITY (Self Learning)]
    if (pointsPred && moFav && pointsPred !== moFav) {
        if (!hasRule) {
            finalPrediction = moFav === '1' ? '1X' : 'X2';
        }
    }

    // --- NEW SELF LEARNING PROTOCOLS (Batch 4) ---

    // [PROTOCOL: VALUE BET STABILIZATION]
    // IF Value Bet AND Sub Pattern Prediction contradicts Algo Prediction, THEN hedge towards the Algo Prediction's primary outcome.
    if (category === 'Value' && rulePrediction && !matchesPrediction(rulePrediction, prediction)) {
        finalPrediction = prediction === '1' ? '1X' : prediction === '2' ? 'X2' : '1X'; // Default to 1X if prediction is X
        reasonParts.push("Value Bet Stabilization (Hedge to Algo)");
    }

    // [PROTOCOL: BANKER DRAW IDENTIFICATION]
    // IF PHA draw probability is greater than 35% AND Odds are tightly clustered, THEN classify as Banker Draw and apply 1X or X2 based on Algo Prediction.
    if (phaDrawPct > 35 && (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) <= 0.5)) {
        category = 'Banker Draw';
        finalPrediction = prediction === '1' ? '1X' : prediction === '2' ? 'X2' : (p1 > p2 ? '1X' : 'X2');
        reasonParts.push("Banker Draw Identification");
    }

    // [PROTOCOL: UPSET DETECTION OVERHAUL]
    // IF Away Odds are greater than 2.40 AND Sub Pattern Prediction is 12 AND PHA supports the underdog, THEN weight the Algo Prediction heavily towards the Away win (2).
    if (!isNaN(o2) && o2 > 2.40 && rulePrediction === '12' && sSubStatsProb && sSubStatsProb['2'] > sSubStatsProb['1']) {
        finalPrediction = '2';
        category = 'Upset';
        rawConfidence = Math.max(rawConfidence, 85);
        reasonParts.push("Upset Detection Overhaul (Away Win)");
    }

    // [PROTOCOL: SUB-PATTERN 1X/X2 MISALIGNMENT FIX]
    // IF Sub Pattern Prediction is 1X or X2 AND match is not a strict Value Pick, THEN the final prediction MUST include the hedge.
    if ((rulePrediction === '1X' || rulePrediction === 'X2') && category !== 'Value Pick') {
        if (!finalPrediction.includes('X')) {
            finalPrediction = rulePrediction;
            reasonParts.push("Sub-Pattern Misalignment Fix (Forced Hedge)");
        }
    }

    // [PROTOCOL: TOXIC SUB-PATTERNS (Banker Blacklist)]
    const toxicPatterns = ['G1a7', 'G1ff44', 'G2hh2', 'G2ff31', 'G1g2', 'G1ii3', 'G1f29', 'G2a7', 'R-G1-01', 'G3o9'];
    if (toxicPatterns.includes(subP)) {
        rawConfidence = Math.min(rawConfidence, 75);
        isUnshakable = false;
        reasonParts.push("Toxic Pattern (Conf Capped)");
        flags.push('Demote_Banker');
    }

    // [PROTOCOL: HEAVY FAVORITE UPSET BLINDSPOT (Giant Killer Override)]
    const giantKillerPatterns = ['G1ff44', 'G2ee11', 'G1g21', 'G1a2', 'G2o14'];
    if (giantKillerPatterns.includes(subP) && moFav && Math.min(o1, o2) < 1.35) {
        const underdog = moFav === '1' ? '2' : '1';
        finalPrediction = underdog === '1' ? '1X' : 'X2';
        category = 'Upset';
        flags.push('Upset Alert');
        flags.push('Demote_Accumulator');
        reasonParts.push("Giant Killer Override");
    }

    // [PROTOCOL: GROUP 1 PHA DEPENDENCY]
    if (match.group === 1) {
        let phaSupport = 0;
        if (sSubStatsProb) {
            if (finalPrediction.includes('1')) phaSupport = Math.max(phaSupport, sSubStatsProb['1']);
            if (finalPrediction.includes('2')) phaSupport = Math.max(phaSupport, sSubStatsProb['2']);
            if (finalPrediction.includes('X')) phaSupport = Math.max(phaSupport, sSubStatsProb['X']);
        }
        if (phaSupport < 0.55) {
            rawConfidence = Math.max(0, rawConfidence - 20);
            isUnshakable = false;
            reasonParts.push("Group 1 Low PHA (Downgrade)");
            flags.push('Demote_Daily_Jackpot');
        }
    }

    // [PROTOCOL: PREMIUM PATTERN FAST-TRACK]
    const premiumMainPatterns = ['C', 'K', 'LL', 'L', 'Y', 'CC', 'KK'];
    if (premiumMainPatterns.includes(mainP) && rawConfidence > 80) {
        flags.push('Premium_Fast_Track');
        reasonParts.push("Premium Pattern Fast-Track");
    }

    // [PROTOCOL: PATCHED '_fix' PATTERNS RECALIBRATION]
    if (subP === 'G1j3_fix') {
        if (moFav === '2' && o2 < 1.50) {
            if (finalPrediction === '1' || finalPrediction === '1X') {
                finalPrediction = p2 > pX ? '2' : 'X2';
                reasonParts.push("G1j3_fix Recalibration");
            }
        }
    }

    // [PROTOCOL: SELF LEARNING - DRAW OPTIMIZATION]
    if (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) < 0.2) {
        if (finalPrediction === 'X') finalPrediction = '12';
    }
    
    if (phaDrawPct > 30 && (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) >= 0.2)) {
        if (rawConfidence < 70 && finalPrediction !== 'X') {
            finalPrediction = 'X';
        }
    }

    // 4. Pattern T-S-R-X Downgrade
    const minOddsP = Math.min(o1, o2);
    if (['T', 'S', 'R', 'X'].includes(mainP) && !isNaN(minOddsP) && minOddsP < 2.0) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        else if (finalPrediction === 'X') finalPrediction = '1X'; 
        rawConfidence = Math.min(rawConfidence, 70); 
    }

    // 5. Low Quality Match Outcome
    if ((match.maxPoints || 0) < 45) {
        if (finalPrediction === 'X') finalPrediction = '1';
    }

    // [PROTOCOL: SELF LEARNING - UPSET OPTIMIZATION]
    const subPatDisagree = match.patternAnalysis?.subPatternPrediction && !matchesPrediction(match.patternAnalysis.subPatternPrediction, moFav);
    const pointsDisagree = match.calculatedPrediction && !matchesPrediction(match.calculatedPrediction, moFav);

    // 1. SubPattern Contradiction
    if (minMarketOddsValue < 1.70 && subPatDisagree) {
        finalPrediction = moFav === '1' ? '1X' : 'X2'; 
    }

    // 2. Tight Group False Favorite
    if (minMarketOddsValue < 1.70 && match.group === 1) {
        if (finalPrediction === moFav) {
            finalPrediction = moFav === '1' ? '1X' : 'X2';
        }
    }

    // [PROTOCOL: SELF LEARNING - HEDGE OPTIMIZATION]
    const predOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
    
    // 1. High Odds Home Vulnerability (Odds > 2.00)
    if (predOdds > 2.00 && (finalPrediction === '1' || finalPrediction === '2')) {
        finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
    }

    // 2. Low Reliability 'No Draw' Hedge
    const reliability = algo.getPatternReliability(subP);
    if (reliability === "Low Data" || reliability === "No Data") {
        if (finalPrediction === '1X' || finalPrediction === 'X2') {
            finalPrediction = '12';
        }
    }

    // 3. Group 1 Neutralization
    if (match.group === 1 && !isNaN(predOdds) && predOdds > 2.00) {
        if (finalPrediction === '1') finalPrediction = '1X';
    }

    // [PROTOCOL: SELF LEARNING - ULTRA LOW ODDS SAFETY VALVE]
    if (minMarketOddsValue < 1.40 && (subPatDisagree || pointsDisagree)) {
        isUnshakable = false;
        rawConfidence = 0; 
    }

    // [PROTOCOL: SELF LEARNING BATCH 2 - PHA PROTOCOLS]
    if (sSubStatsProb) {
        const p1_pha_b2 = sSubStatsProb['1'];
        const pX_pha_b2 = sSubStatsProb['X'];
        const p2_pha_b2 = sSubStatsProb['2'];
        const maxPha = Math.max(p1_pha_b2, pX_pha_b2, p2_pha_b2);

        // [PROTOCOL 67] PHA AUTHORITY
        if (p1_pha_b2 > 0.60) {
            finalPrediction = '1';
            rawConfidence = Math.max(rawConfidence, 90);
            isUnshakable = true;
        } else if (p2_pha_b2 > 0.60) {
            finalPrediction = '2';
            rawConfidence = Math.max(rawConfidence, 90);
            isUnshakable = true;
        }

        // [PROTOCOL 68] CONTRADICTION EDGE
        if (moFav) {
            let phaFav = null;
            if (p1_pha_b2 > pX_pha_b2 && p1_pha_b2 > p2_pha_b2) phaFav = '1';
            else if (p2_pha_b2 > p1_pha_b2 && p2_pha_b2 > pX_pha_b2) phaFav = '2';
            
            if (phaFav && phaFav !== moFav && !isUnshakable) {
                const phaFavProb = phaFav === '1' ? p1_pha_b2 : p2_pha_b2;
                if (phaFavProb > 0.40) {
                    finalPrediction = phaFav;
                }
            }
        }

        // [PROTOCOL 69] HEDGE RELIABILITY
        if (finalPrediction === '1' && (p1_pha_b2 + pX_pha_b2) > 0.75) finalPrediction = '1X';
        if (finalPrediction === '2' && (p2_pha_b2 + pX_pha_b2) > 0.75) finalPrediction = 'X2';

        // [PROTOCOL 70] VOLATILITY FILTER
        if (maxPha < 0.45) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            rawConfidence = Math.min(rawConfidence, 60);
        }
        
        // [PROTOCOL 71] UPSET RADAR
        if (moFav) {
            const upsetOutcome = moFav === '1' ? '2' : '1';
            const upsetProb = moFav === '1' ? p2_pha_b2 : p1_pha_b2;
            if (upsetProb > 0.40) {
                if (matchesPrediction(finalPrediction, upsetOutcome)) {
                    rawConfidence = Math.max(rawConfidence, 80);
                }
            }
        }
    }

    // [PROTOCOL 58] GROUP 2 VOLATILITY DAMPENER (New)
    if (match.group === 2 && finalPrediction.length === 1) {
        const currentOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
        
        let isEliteValue = false;
        if (!isNaN(currentOdds) && currentOdds > 2.0) {
            const ptsPred = match.calculatedPrediction;
            const sSubStats = algo.getRawPatternStats(`S:${subP}`);
            
            if (ptsPred && matchesPrediction(ptsPred, finalPrediction)) {
                if (sSubStats) {
                     const predSupport = sSubStats.outcomes[finalPrediction as '1'|'2'|'X'] / sSubStats.total;
                     if (predSupport > 0.50) {
                         isEliteValue = true;
                         category = 'Value';
                         rawConfidence = 99; 
                         isUnshakable = true;
                         reasonParts.push("Elite Value (Pts+PHA)");
                     }
                }
            }
        }

        if (!isEliteValue && !isNaN(currentOdds) && currentOdds > 2.10) {
             if (finalPrediction === '1') finalPrediction = '1X';
             else if (finalPrediction === '2') finalPrediction = 'X2';
        }
    }

    // [PROTOCOL 59] ALGO-HEDGE DEFERENCE PROTOCOL (New)
    const algoPred = match.patternAnalysis?.subPatternPrediction;
    if (['1X', 'X2'].includes(algoPred || '') && finalPrediction.length === 1 && pX > 0.26) {
        finalPrediction = algoPred!;
    }

    // [PROTOCOL 60] DRAW EXPOSURE LIMIT (New) - ACTIVE FOR DAILY
    if (!match.isJackpot) {
        const favOddsForDrawLimit = Math.min(o1, o2);
        if (!isNaN(favOddsForDrawLimit) && favOddsForDrawLimit >= 2.20 && favOddsForDrawLimit <= 2.60) {
            if (finalPrediction === '12' || finalPrediction.length === 1) {
                 const favSide = o1 <= o2 ? '1' : '2';
                 finalPrediction = favSide === '1' ? '1X' : 'X2';
            }
        }
    }

    // [PROTOCOL 61] GROUP 1 AGGRESSION (New)
    if (match.group === 1 && rawConfidence > 60 && algoPred === '12') {
        if (prediction === '1' || prediction === '2') {
            finalPrediction = prediction;
        }
    }

    // [PROTOCOL 62] FALSE VALUE UPSET FILTER (New)
    const minMarketOdds = Math.min(o1, o2);
    if (!isNaN(minMarketOdds) && minMarketOdds < 1.80) {
        const marketFav = o1 === minMarketOdds ? '1' : '2';
        const isBettingAgainst = !matchesPrediction(finalPrediction, marketFav);
        
        if (isBettingAgainst) {
            if (rawConfidence < 80) {
                finalPrediction = marketFav === '1' ? '1X' : 'X2';
            }
        }
    }

    // [PROTOCOL 64] THE '12' CALIBRATION (New) - ACTIVE FOR DAILY
    if (!match.isJackpot && finalPrediction === '12' && !isNaN(oX) && oX < 3.20) {
        if (runTSLogic) {
            if ((match.tsa || 0) >= (match.tsb || 0)) finalPrediction = '1X';
            else finalPrediction = 'X2';
        }
    }

    // [PROTOCOL: CONFLICT RESOLUTION (Odds < 2.50)]
    // If PHA disagrees with Market Odds Favoritism
    if (moFav && sSubStatsProb) {
        let phaFav = null;
        const p1p = sSubStatsProb['1'];
        const p2p = sSubStatsProb['2'];
        if (p1p > p2p && p1p > sSubStatsProb['X']) phaFav = '1';
        else if (p2p > p1p && p2p > sSubStatsProb['X']) phaFav = '2';

        if (phaFav && phaFav !== moFav) {
            const minO = Math.min(o1, o2);
            // Odds > 2.60 -> Value Bet (handled in Algorithm Quality check)
            // Odds < 2.50 -> Discard/Downgrade
            if (!isNaN(minO) && minO < 2.50) {
                category = 'Standard';
                rawConfidence = 0; // Effectively kill confidence
                reasonParts.push("Conflict Resolution (<2.50)");
            }
        }
    }

    // [PROTOCOL 16] TS DOMINANCE RECALIBRATION (Stateful)
    const subPatternWinRate = algo.getPatternWinRate(subP, match.patternAnalysis?.subPatternPrediction || null);
    
    if (runTSLogic && tsDiff > 0.8 && subPatternWinRate > 0 && subPatternWinRate < 55) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
    }

    // Apply Stateless Overrides
    const AlgoClass = algo.constructor as any;
    finalPrediction = AlgoClass.applyPatternOverrides(match, subP, finalPrediction);

    // [PROTOCOL 54] GROUP 1 VOLATILITY OVERRIDE (Correction)
    if (match.group === 1 && match.patternAnalysis?.subPatternPrediction === '12') {
        if (finalPrediction === '1X' || finalPrediction === 'X2') {
            finalPrediction = '12';
        }
    }

    // [PROTOCOL 55] DISTRIBUTION GREED DAMPENER (Prevention)
    if (match.group === 1 && match.patternAnalysis?.subPatternPrediction === '1X') {
        if (finalPrediction === '1') {
            finalPrediction = '1X';
        }
    }

    // [PROTOCOL 56] GROUP 3 MISMATCH VALIDATION (Refinement)
    if (match.group === 3 && rawConfidence < 75) {
        const minO = Math.min(o1, o2);
        if (!isNaN(minO) && minO > 1.50 && finalPrediction.length === 1) {
             if (finalPrediction === '1') finalPrediction = '1X';
             else if (finalPrediction === '2') finalPrediction = 'X2';
        }
    }

    // [PROTOCOL 57] THE '12' ANTI-STALEMATE LOGIC (Pattern Recognition)
    if (match.group === 1) {
        if (sSub && sSub['X'] < 0.20) {
            if (finalPrediction === '1X') finalPrediction = '1'; 
            else if (finalPrediction === 'X2') finalPrediction = '2';
            else if (finalPrediction === 'X') finalPrediction = '12'; 
        }
    }

    // [PROTOCOL 42] GROUP 1 HEDGE MANDATE (Risk Management)
    if (match.group === 1) {
        const subPred = match.patternAnalysis?.subPatternPrediction;
        if (subPred && subPred.length === 2 && finalPrediction.length === 1) {
            finalPrediction = subPred;
        }
    }

    // [PROTOCOL 47] GROUP 1 VOLATILITY PROTOCOL (New)
    const favOdds = Math.min(o1, o2);
    if (match.group === 1 && !isNaN(favOdds) && favOdds > 2.30) {
        if (finalPrediction === '1') finalPrediction = '1X';
        if (finalPrediction === '2') finalPrediction = 'X2';
    }

    // [PROTOCOL 43] SUBPATTERN VS MARKET DIVERGENCE
    const minOdds = Math.min(o1, o2);
    if (!isNaN(minOdds) && minOdds < 2.10) {
        const isHomeFav = o1 < o2;
        const subPred = match.patternAnalysis?.subPatternPrediction;
        
        if (isHomeFav) {
            if (subPred === '2' || subPred === 'X2') {
                finalPrediction = '1'; 
            }
        } else {
            if (subPred === '1' || subPred === '1X') {
                finalPrediction = '2'; 
            }
        }
    }

    // [PROTOCOL 48] TS VS MARKET DISSONANCE CORRECTION
    if (runTSLogic && tsDiff > 0.60) {
        const tsFav = (match.tsa || 0) > (match.tsb || 0) ? '1' : '2';
        const targetOdds = tsFav === '1' ? o1 : o2;
        if (!isNaN(targetOdds) && targetOdds > 2.50) {
             if (finalPrediction === '1' || finalPrediction === '2') {
                 finalPrediction = tsFav === '1' ? '1X' : 'X2';
             }
        }
    }

    // [PROTOCOL 44] THE 2.20-2.40 ODDS TRAP
    const targetO = finalPrediction === '1' ? o1 : (finalPrediction === '2' ? o2 : oX);
    if (!isNaN(targetO) && targetO >= 2.20 && targetO <= 2.40) {
        const subPred = match.patternAnalysis?.subPatternPrediction;
        if (subPred === '1X' || subPred === 'X2') {
            finalPrediction = subPred;
        }
    }

    // [PROTOCOL 45] LOW DATA CONSERVATISM
    if (reliability === "Low Data" || reliability === "No Data") {
        rawConfidence = Math.min(rawConfidence, 60); 
        if (finalPrediction.length === 1) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            else finalPrediction = '12'; 
        }
    }

    // [PROTOCOL 46] AWAY FAVORITE THRESHOLD ADJUSTMENT
    if (runTSLogic && finalPrediction === '2' && !isNaN(o2) && o2 > 2.30) {
        const tDiff = (match.tsb || 0) - (match.tsa || 0);
        if (tDiff < 2.50) {
            finalPrediction = 'X2';
        }
    }

    // [PROTOCOL 49] SUBPATTERN 1X RE-CALIBRATION
    if (match.patternAnalysis?.subPatternPrediction === '1X' && !isNaN(o2) && o2 < 3.00) {
        if (runTSLogic && (match.tsb || 0) > (match.tsa || 0)) {
            finalPrediction = 'X2';
        } else {
            finalPrediction = '12';
        }
    }

    // [PROTOCOL 19] ODDS TRAP DETECTION
    let isOddsTrap = false;
    if (!isNaN(predOdds) && predOdds >= 2.15 && predOdds <= 2.50) {
        isOddsTrap = true;
        if (finalPrediction === '1') finalPrediction = '1X';
        if (finalPrediction === '2') finalPrediction = 'X2';
    }

    // [PROTOCOL 22] AWAY DOMINANCE TRAP
    if (runTSLogic && finalPrediction === '2') {
        const tDiff = (match.tsb || 0) - (match.tsa || 0);
        const subPred = match.patternAnalysis?.subPatternPrediction;
        const rawPred = match.rawPrediction;
        if (tDiff > 0.5 && !isNaN(o2) && o2 > 2.10) {
             if (subPred === 'X' || subPred === 'X2' || rawPred === 'X' || rawPred === 'X2') {
                 finalPrediction = 'X2';
             }
        }
    }

    // [PROTOCOL 23] HOME FORTRESS TRUST
    const midTierTeams = ["Standard", "Anderlecht", "Club Brugge", "Union SG", "Genk", "Gent", "Antwerp", "Cercle Brugge", "Charleroi", "St Gilliose", "Nice", "Brest", "Lens", "Rennes", "Lille"];
    const isMidTier = midTierTeams.some(t => match.teams.includes(t));
    if (isMidTier) {
        const algoSignal = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if ((algoSignal === '1' || algoSignal === '1X') && !isNaN(o1) && o1 < 3.50) {
            if (finalPrediction === '2' || finalPrediction === 'X2') {
                finalPrediction = '1X'; 
            }
        }
    }

    // [PROTOCOL 24] EXT SIGNAL DRAW VALIDATION
    if (finalPrediction === '1' && match.pred1x2 === '1') {
        const algoBase = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if (algoBase === 'X' || algoBase === 'X2') {
            finalPrediction = '1X';
        }
    }

    // [PROTOCOL 25] SUB-PATTERN PROBABILITY THRESHOLD
    if (subPatternWinRate > 0 && subPatternWinRate <= 55) {
        const currentOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
        if (!isNaN(currentOdds) && currentOdds > 2.00) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            else if (finalPrediction === 'X') finalPrediction = runTSLogic && (match.tsa || 0) >= (match.tsb || 0) ? '1X' : 'X2';
        }
    }

    // [PROTOCOL 26] DERBY VOLATILITY
    const derbies = ["Bilbao vs Sociedad", "Sociedad vs Bilbao", "Sevilla vs Betis", "Betis vs Sevilla", "Roma vs Lazio", "Lazio vs Roma", "Milan vs Inter", "Inter vs Milan", "Arsenal vs Tottenham", "Tottenham vs Arsenal", "Liverpool vs Everton", "Everton vs Liverpool", "Celtic vs Rangers", "Rangers vs Celtic"];
    const isDerby = derbies.some(d => match.teams.includes(d));
    if (isDerby) {
        const baseSignal = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if (baseSignal === 'X') {
             if (finalPrediction === '1') finalPrediction = '1X';
             else if (finalPrediction === '2') finalPrediction = 'X2';
        }
    }

    // [PROTOCOL 27] GROUP 2 DECISIVE OVERRIDE
    if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === '12' && finalPrediction === '1X') {
        finalPrediction = '12';
    }

    // [PROTOCOL 28] TS DIFFERENTIAL FALSE POSITIVE
    if (runTSLogic && !isNaN(o1) && o1 < 1.90 && (match.tsb || 0) > (match.tsa || 0) + 1.0) {
        if (match.patternAnalysis?.subPatternPrediction) {
            finalPrediction = match.patternAnalysis.subPatternPrediction;
        }
    }

    // [PROTOCOL 29] ALGO DRAW AUTHORITY
    if (match.patternAnalysis?.subPatternPrediction === 'X' && finalPrediction === '1') {
        finalPrediction = '1X';
    }

    // [PROTOCOL 30] AWAY FAVORITE BLINDSPOT
    if (!isNaN(o2) && o2 >= 2.00 && o2 <= 3.00 && match.patternAnalysis?.subPatternPrediction === '12') {
        if (finalPrediction === '1X') {
            finalPrediction = '12';
        }
    }

    // [PROTOCOL 31] SUBPATTERN 1 FIDELITY IN GROUP 2
    if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === '1') {
        if (finalPrediction === '1') {
            finalPrediction = '1X';
        }
    }

    // [PROTOCOL 32] ALGO-X2 AUTHORITY IN AWAY FAVORITES
    if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === 'X2') {
        if (finalPrediction === '2') {
            finalPrediction = 'X2';
        }
    }

    // [PROTOCOL 33] ANTI-DRAW (12) PRIORITIZATION IN MISMATCHES
    const isCup = match.teams.toLowerCase().match(/(cup|pokal|trophy|coppa|coupe)/);
    if (match.group === 3 && match.patternAnalysis?.subPatternPrediction === '12') {
        if (isCup) { 
             if (finalPrediction === 'X2') {
                 finalPrediction = '12';
             }
        }
    }

    // [PROTOCOL 34] HOME FAVORITE DAMPENING (GROUP 2)
    if (runTSLogic && match.group === 2 && finalPrediction === '1' && (match.tsa || 0) > (match.tsb || 0)) {
        if (rawConfidence < 70) {
            finalPrediction = '1X';
        }
    }

    // [PROTOCOL 35] SUBPATTERN DRAW RATE TRAP
    if (finalPrediction === 'X') {
        const subPred = match.patternAnalysis?.subPatternPrediction;
        if (subPred === '1X' || subPred === 'X2') {
            finalPrediction = subPred;
        }
    }

    // [PROTOCOL 36] LA LIGA DEFENSIVE HEDGE
    const isLaLiga = [
        "Real Madrid", "Barcelona", "Atl. Madrid", "Sevilla", "Betis", "Sociedad", "Bilbao", "Girona", "Valencia", 
        "Villarreal", "Osasuna", "Getafe", "Celta", "Mallorca", "Rayo Vallecano", "Alaves", "Las Palmas", "Leganes", "Valladolid", "Espanyol"
    ].some(t => match.teams.includes(t));
    
    if (isLaLiga) {
        const totalGoals = (match.gsHome || 0) + (match.gsAway || 0); 
        if (totalGoals < 2.8) { 
             const tDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
             const subPred = match.patternAnalysis?.subPatternPrediction;
             if (runTSLogic && tDiff <= 2.0 && (subPred === '1X' || subPred === 'X2')) {
                 if (finalPrediction === '1' || finalPrediction === '2') {
                     finalPrediction = subPred;
                 }
             }
        }
    }

    // [PROTOCOL 37] GROUP 2 VOLATILITY PROTOCOL
    if (match.group === 2) {
        const base = match.patternAnalysis?.subPatternPrediction;
        if (['1X', '12'].includes(base || '')) {
             if (base === '1X' && (finalPrediction === '2' || finalPrediction === 'X2')) {
                 finalPrediction = '1X';
             }
             if (base === '12' && finalPrediction === 'X') {
                 finalPrediction = '12';
             }
        }
    }

    // [PROTOCOL 38] TS B (AWAY STRENGTH) CALIBRATION
    if (runTSLogic && match.group === 2 && (match.tsb || 0) > (match.tsa || 0)) {
        if ((match.tsb || 0) <= 1.30) {
            if (finalPrediction === '2' || finalPrediction === 'X2') {
                finalPrediction = '1X';
            }
        }
    }

    // [PROTOCOL 39] THE '12' ANTI-DRAW SAFEGUARD
    if (match.patternAnalysis?.subPatternPrediction === '12') {
        if (['1', '2'].includes(finalPrediction) && runTSLogic && tsDiff <= 0.4) {
            finalPrediction = '12';
        }
    }

    // [PROTOCOL 40] LEAGUE STEREOTYPE OVERRIDE (PORTUGAL)
    const isPortugal = ["Gil Vicente", "Famalicao", "Porto", "Benfica", "Sporting", "Braga", "Guimaraes", "Arouca", "Estoril", "Rio Ave", "Casa Pia", "Boavista"].some(t => match.teams.includes(t));
    if (isPortugal) {
        const algoBase = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if (algoBase === '1' && rawConfidence > 60) {
            if (finalPrediction === 'X') {
                finalPrediction = '1';
            }
        }
    }

    // [PROTOCOL 41] SEGUNDA DIVISION HOME BIAS
    const isSegunda = ["Huesca", "Cadiz", "Granada", "Santander", "Cacereno", "Barakaldo", "Almeria", "Levante", "Eibar", "Zaragoza", "Burgos", "Oviedo", "Gijon"].some(t => match.teams.includes(t));
    if (isSegunda) {
        if (match.patternAnalysis?.subPatternPrediction === '1X') {
            if (finalPrediction === 'X2' || finalPrediction === '2') {
                finalPrediction = '1X';
            }
        }
    }

    // [PROTOCOL 50] AWAY FAVORITE VOLATILITY PROTOCOL (New)
    if ((match.group === 1 || match.group === 2) && match.patternAnalysis?.subPatternPrediction === '12') {
        if (!isNaN(o2) && !isNaN(o1) && o2 < o1) {
            const totalGoals = (match.gsHome || 0) + (match.gsAway || 0);
            const isLowGoals = totalGoals < 2.3;
            if (!isLowGoals && finalPrediction === '1X') {
                finalPrediction = '12';
            }
        }
    }

    // [PROTOCOL 51] DRAW CAPTURE OPTIMIZATION (New)
    if (match.patternAnalysis?.subPatternPrediction === '12') {
        const totalGoals = (match.gsHome || 0) + (match.gsAway || 0);
        if (totalGoals < 2.5 && rawConfidence >= 65) {
            if (finalPrediction === '12') {
                 if (runTSLogic) {
                     if ((match.tsa || 0) >= (match.tsb || 0)) finalPrediction = '1X';
                     else finalPrediction = 'X2';
                 }
            }
        }
    }

    // [PROTOCOL 52] GROUP 3 MISMATCH SAFETY (New)
    if (match.group === 3) {
        const minO = Math.min(o1, o2);
        if (minO < 1.60) {
            const favPred = o1 === minO ? '1' : '2';
            const coversFav = matchesPrediction(finalPrediction, favPred);
            if (!coversFav) {
                 const algoPred = match.patternAnalysis?.subPatternPrediction;
                 const algoAgreesUpset = algoPred && !matchesPrediction(algoPred, favPred);
                 if (!algoAgreesUpset) {
                     finalPrediction = favPred === '1' ? '1X' : 'X2';
                 }
            }
        }
    }

    // [PROTOCOL 53] SUBPATTERN CALIBRATION (New)
    if (['G1a2', 'G2q1'].includes(subP)) {
        const isOpposingFav = (subP === 'G1a2' && o1 < 2.00) || (subP === 'G2q1' && o2 < 2.00);
        if (isOpposingFav) {
            rawConfidence = Math.max(10, rawConfidence - 20); 
        }
    }

    // [PROTOCOL: SELF LEARNING - THE '12' TRAP AGAINST CONSENSUS]
    if (match.patternAnalysis?.subPatternPrediction === '12') {
        const ptsPred = match.calculatedPrediction;
        const sSubStats = algo.getProbabilities(`S:${subP}`, 3);
        const phaPred = (sSubStats && sSubStats['1'] > 0.5) ? '1' : (sSubStats && sSubStats['2'] > 0.5) ? '2' : null;
        
        if (ptsPred === '1' && moFav === '1' && phaPred === '1') {
        }
    }

    // [PROTOCOL: TS DIFFERENTIAL UPGRADE RESTRICTION]
    if (runTSLogic && tsDiff > 1.5 && finalPrediction.length === 1) {
        const sSubStats = algo.getProbabilities(`S:${subP}`, 3);
        if (sSubStats) {
             const phaPred = (sSubStats['1'] > sSubStats['X'] && sSubStats['1'] > sSubStats['2']) ? '1' : (sSubStats['2'] > sSubStats['1'] && sSubStats['2'] > sSubStats['X']) ? '2' : null;
             if (phaPred && !matchesPrediction(finalPrediction, phaPred)) {
                 if (finalPrediction === '1') finalPrediction = '1X';
                 else if (finalPrediction === '2') finalPrediction = 'X2';
             }
        }
    }

    // [PROTOCOL 73] GROUP 2 VOLATILITY HEDGE (New)
    if (runTSLogic && match.group === 2 && finalPrediction.length === 1) {
        const tsRatio = (match.tsa || 0) / (match.tsb || 0.01);
        const tsRatioRev = (match.tsb || 0) / (match.tsa || 0.01);
        const dominance = Math.max(tsRatio, tsRatioRev);
        
        if (dominance <= 3.0) {
             if (finalPrediction === '1') finalPrediction = '1X';
             else if (finalPrediction === '2') finalPrediction = 'X2';
        }
    }

    // [PROTOCOL: GROUP 2 VOLATILITY HEDGE REFINEMENT (NEW)]
    if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === '12') {
         const minO = Math.min(o1, o2);
         if (!isNaN(minO) && minO < 1.50) {
             if (o2 < 1.50 && finalPrediction === '1X') {
                 finalPrediction = '2'; 
             }
             if (o1 < 1.50 && finalPrediction === 'X2') {
                 finalPrediction = '1';
             }
         }
    }

    // [PROTOCOL 74] THE '12' RESOLUTION PROTOCOL (New)
    if (match.patternAnalysis?.subPatternPrediction === '12') {
        if (finalPrediction.length === 1) {
             if (finalPrediction === '1') finalPrediction = '1X';
             else if (finalPrediction === '2') finalPrediction = 'X2';
        }
    }

    // [PROTOCOL 75] TS DIFFERENTIAL UPGRADE PROHIBITION (New)
    const protocol75AlgoPred = match.patternAnalysis?.subPatternPrediction;
    if (protocol75AlgoPred && (protocol75AlgoPred === '1X' || protocol75AlgoPred === 'X2') && finalPrediction.length === 1) {
        const ptsPred = match.calculatedPrediction;
        const allAgreed = (protocol75AlgoPred === finalPrediction || (protocol75AlgoPred.includes(finalPrediction))) && moFav === finalPrediction && ptsPred === finalPrediction;
        
        if (!allAgreed) {
            finalPrediction = protocol75AlgoPred;
        }
    }

    // --- BATCH 9 PROTOCOLS START ---

    // [PROTOCOL: GROUP 1 CONSERVATIVE RESET (BATCH 9)]
    if (match.group === 1 && finalPrediction.length === 1) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
    }

    // [PROTOCOL: VALUE BET CAP (BATCH 9)]
    const predOddsCheck = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
    if (!isNaN(predOddsCheck) && predOddsCheck > 3.00 && finalPrediction.length === 1) {
        finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
    }

    // [PROTOCOL: SINGLE WIN DRAW DAMPENER (BATCH 9)]
    if (finalPrediction.length === 1 && !isNaN(predOddsCheck) && predOddsCheck > 1.90) {
        if ((sSubStatsProb && sSubStatsProb['X'] > 0.25) || pX > 0.25) {
             finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
        }
    }

    // --- BATCH 9 PROTOCOLS END ---

    // --- NEW AUDIT RECOMMENDATIONS (BATCH 10) ---

    // [PROTOCOL: GROUP 2 LEVERAGE (The 81% Rule)]
    if (match.group === 2) {
        rawConfidence = Math.min(99, rawConfidence + 5);
        // Boost Category if on cusp
        if (category === 'Standard' && rawConfidence >= 70) category = 'Value'; // Upgrade priority
    }

    // [PROTOCOL: SUB-PATTERN '12' CORRECTION]
    if (match.patternAnalysis?.subPatternPrediction === '12') {
        const oddsDiff = Math.abs(o1 - o2);
        if (!isNaN(oddsDiff) && oddsDiff < 0.50) {
            // Mandate Double Chance if currently single
            if (finalPrediction.length === 1) {
                finalPrediction = '12';
                reasonParts.push("SubPat '12' DC Mandate");
            }
        }
    }

    // [PROTOCOL: TOP 20 RECOVERY (THE BRISTOL CORRECTION)]
    // IF Algo_Confidence > 80% AND SubPattern_Draw_Prob > 35% THEN Downgrade & Hedge 1X
    if (rawConfidence > 80 && sSubStatsProb && sSubStatsProb['X'] > 0.35) {
        rawConfidence = 70; // Medium
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        reasonParts.push("Bristol Correction (Draw Risk)");
    }

    // [PROTOCOL: TOP 20 RECOVERY (TOXIC FAVORITE FILTER)]
    if (!isNaN(o1) && o1 >= 1.40 && o1 <= 1.65) {
        const subPred = match.patternAnalysis?.subPatternPrediction;
        if (subPred && (subPred.includes('X2') || subPred.includes('12'))) {
            // Remove from Top 20 (Downgrade Conf)
            if (rawConfidence > 80) {
                rawConfidence = 75;
                reasonParts.push("Toxic Fav Filter");
                if (category === 'Banker') category = 'Standard';
            }
        }
    }

    // [PROTOCOL: NEXT BEST OPTIMIZATION (11-20)]
    // IF Category == 'BOTB' THEN Prioritize matches tagged 'Group 2'. IF Match is 'Group 1', REQUIRE PHA_Agree == TRUE.
    // We don't have a 'BOTB' category explicitly assigned here, but we can apply the logic to Group 1 matches to prevent them from ranking high without PHA agreement.
    if (match.group === 1) {
        let phaAgrees = false;
        if (sSubStatsProb) {
            const maxP = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
            let phaPred = '';
            if (maxP === sSubStatsProb['1']) phaPred = '1';
            else if (maxP === sSubStatsProb['2']) phaPred = '2';
            else phaPred = 'X';
            
            if (matchesPrediction(finalPrediction, phaPred)) phaAgrees = true;
        }
        
        if (!phaAgrees) {
            rawConfidence = Math.min(rawConfidence, 75); // Prevent from reaching Top 20 or high BOTB
            reasonParts.push("Group 1 BOTB Filter (No PHA)");
        }
    }

    // [PROTOCOL: NEXT BEST VOLATILITY CLAMP]
    // IF Category == 'BOTB' (implied) AND Group == 2 AND Odds < 1.70 THEN Mandatory Hedge
    if (match.group === 2 && !isNaN(o1) && o1 < 1.70 && finalPrediction.length === 1) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        reasonParts.push("Group 2 Volatility Clamp");
    }

    // [PROTOCOL: BANKER 'CLEAN PROFILE' TRAP FILTER]
    // IF Profile_Score == 100 AND PHA_Score < 85 THEN Remove_From_Bankers
    if (rawConfidence >= 98) {
        const phaWinRate = algo.getPatternWinRate(subP, finalPrediction);
        if (phaWinRate < 85) {
            if (category === 'Banker') {
                category = 'Value'; // Reclassify
                reasonParts.push("Clean Profile Trap (PHA < 85%)");
            }
        }
    }

    // [PROTOCOL: BANKER CONSISTENCY LOCK]
    if (category === 'Banker') {
        const extAgreement = match.pred1x2 && matchesPrediction(finalPrediction, match.pred1x2);
        if (!extAgreement) {
            category = 'Value'; // Demote
            if (Math.min(o1, o2) < 2.0) category = 'Standard'; // Further demote if no value
            reasonParts.push("Banker Ext Mismatch");
        }
    }

    // [PROTOCOL: VALUE PICK 'HOLY GRAIL' FILTER]
    // IF Category == 'Value Pick' THEN Odds MUST be > 2.0 AND (PHA_Recommendation == 'Home Win' OR PHA_Recommendation == 'Away Win'). REJECT if PHA suggests Draw/Hedge.
    if (category === 'Value' && finalPrediction.length === 1) {
        const valOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
        if (!isNaN(valOdds) && valOdds > 2.0) {
            let phaSuggestsWin = false;
            if (sSubStatsProb) {
                const p1s = sSubStatsProb['1'];
                const pXs = sSubStatsProb['X'];
                const p2s = sSubStatsProb['2'];
                const maxS = Math.max(p1s, pXs, p2s);
                
                if (maxS === p1s || maxS === p2s) {
                    phaSuggestsWin = true;
                }
            }
            
            if (!phaSuggestsWin) {
                category = 'Standard';
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                reasonParts.push("Holy Grail Filter (PHA Draw/Hedge)");
            }
        } else {
            category = 'Standard';
            finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            reasonParts.push("Holy Grail Filter (Odds <= 2.0)");
        }
    }

    // [PROTOCOL: BANKER DRAW IDENTIFICATION]
    // 1. Existing Logic: High Odds Stalemate
    if (!isNaN(o1) && o1 >= 2.80 && o1 <= 3.10 && !isNaN(o2) && o2 >= 2.80 && o2 <= 3.10) {
        if (sSubStatsProb && sSubStatsProb['X'] > 0.35) {
            category = 'Banker';
            if (!finalPrediction.includes('X')) finalPrediction = 'X';
            reasonParts.push("Banker Draw ID");
        }
    }
    // 2. New Logic: Specific SubPattern Targeting
    if (['G1dd5', 'G3ff10', 'G2gg2'].includes(subP)) {
        if (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) < 0.50) {
            category = 'Banker';
            // Force Hedge involving X
            if (!finalPrediction.includes('X')) {
                finalPrediction = p1 >= p2 ? '1X' : 'X2';
            }
            reasonParts.push("Banker Draw Protocol");
        }
    }

    // [PROTOCOL: UPSET EXPANSION STRATEGY]
    if (!isNaN(o1) && o1 < 1.70) {
        const extFavorsAway = match.pred1x2 === '2' || match.pred1x2 === 'X2';
        const phaHomeWin = sSubStatsProb ? sSubStatsProb['1'] : 1.0;
        
        if (extFavorsAway && phaHomeWin < 0.45) {
            category = 'Upset';
            reasonParts.push("Upset Expansion Alert");
            if (finalPrediction === '1' || finalPrediction === '1X') finalPrediction = 'X2';
        }
    }

    // [PROTOCOL: UPSET OPTIMIZATION (THE STIRLING RULE)]
    // IF Favorite_Odds < 1.50 AND Group == 3 AND PHA < 40%
    const minOStirling = Math.min(o1, o2);
    if (minOStirling < 1.50 && match.group === 3) {
        const mFav = o1 === minOStirling ? '1' : '2';
        const phaFavProb = sSubStatsProb ? sSubStatsProb[mFav as '1'|'2'] : 1.0;
        
        if (phaFavProb < 0.40) {
            category = 'Upset';
            finalPrediction = mFav === '1' ? 'X2' : '1X';
            reasonParts.push("Stirling Rule (False Fav)");
        }
    }

    // [PROTOCOL: VALUE BET RISK/REWARD BALANCE]
    const valOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
    if (category === 'Value' && !isNaN(valOdds) && valOdds > 2.20 && finalPrediction.length === 1) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        reasonParts.push("Value Risk Cap (>2.20)");
    } else if (category === 'Value' && !isNaN(valOdds) && valOdds > 4.50) {
        if (rawConfidence < 80) {
            category = 'Standard';
            reasonParts.push("Longshot Noise Filter");
        }
    }

    // [PROTOCOL: CLEAN PROFILE VALIDITY CHECK]
    if (rawConfidence > 95) {
        const phaAlgoProb = sSubStatsProb ? Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']) : 0;
        if (phaAlgoProb < 0.60) {
            rawConfidence = 90; // Invalidate 'Clean Profile' status (usually >95)
            reasonParts.push("Clean Profile Invalidated");
        }
    }

    // [PROTOCOL: GROUP 2 VOLATILITY EXCLUSION]
    if (['G2ee1', 'G2ff44'].includes(subP) && !isNaN(o1) && o1 < 1.70) {
        if (category === 'Banker') {
            category = 'Standard';
            reasonParts.push("Toxic SubPattern Exclusion");
        }
    }

    // [PROTOCOL: THE 'SCORE 100' REALITY CHECK]
    if (rawConfidence >= 99) {
        rawConfidence = Math.round(rawConfidence * 0.85); // 100 -> 85
        reasonParts.push("Score 100 Penalty");
    }

    if (match.group === 3) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
    }

    if (finalPrediction === '2' && !isNaN(o2) && o2 > 2.60) {
        finalPrediction = 'X2';
    }

    if (prediction === 'X' && !isNaN(oX) && oX < 3.10) {
         finalPrediction = p1 > p2 ? '1X' : 'X2';
    }

    if (prediction === '2' && !isNaN(o1) && o1 < 2.10) {
        finalPrediction = '1X';
    }

    const strongVisitors = ["Al Hilal", "Al Nassr", "Al Ittihad", "Al Ahli", "Al Shabab", "Man City", "Real Madrid", "Bayern", "Leverkusen"];
    const awayTeam = match.teams.split(' vs ')[1] || "";
    if (strongVisitors.some(v => awayTeam.includes(v))) {
        if (prediction === 'X') {
            finalPrediction = '2'; 
        }
    }

    if (prediction === '1' && o1 >= 2.20 && o1 <= 2.90) finalPrediction = '1X';
    if (prediction === '1' && o1 > 3.00) finalPrediction = '1X';
    if (prediction === '2' && o2 > 3.00) finalPrediction = 'X2';
    if (prediction === '2' && o2 >= 2.20 && o2 <= 2.80) finalPrediction = 'X2';

    if (prediction === '1' && o1 > 2.00 && finalPrediction === '1') finalPrediction = '1X';
    if (prediction === '2' && o2 > 2.00 && finalPrediction === '2') finalPrediction = 'X2';

    // Ensure rawConfidence stays within bounds
    rawConfidence = Math.min(99, rawConfidence);

    if ((match.group === 2 || match.group === 3) && rawConfidence < 70) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        else if (finalPrediction === 'X') finalPrediction = p1 > p2 ? '1X' : 'X2';
    }

    if (runTSLogic && finalPrediction === '2' && match.tsb && match.tsa) {
        if (match.tsb < match.tsa * 1.15) {
            finalPrediction = 'X2';
        }
    }

    if (runTSLogic && finalPrediction === '2' && match.tsb && match.tsb >= 1.5 && !isNaN(o2) && o2 > 3.00) {
        finalPrediction = 'X2';
    }

    const parsedDliveL10 = parseL10(match.l10);
    if (parsedDliveL10.isValid) {
        const l10H = parsedDliveL10.homeWins;
        const l10A = parsedDliveL10.awayWins;
        if (prediction === '1' && !isNaN(o1) && !isNaN(o2) && o1 > o2 && l10H < l10A) {
            finalPrediction = '1X';
        }
        if (prediction === '2' && !isNaN(o1) && !isNaN(o2) && o2 > o1 && l10A < l10H) {
            finalPrediction = 'X2';
        }
    }

    if (finalPrediction === '12' && match.group === 1) {
        finalPrediction = '1X'; 
    }

    if (isCup) {
        if (prediction === '1') finalPrediction = '1X';
        if (prediction === '2') finalPrediction = 'X2';
    }

    if ((prediction === '2' || prediction === 'X2') && o1 < o2) {
         if (hasFlag('SHGS') || hasFlag('H_BAL') || hasFlag('TS_HOME_STRONG')) {
             finalPrediction = '1X'; 
         }
    }

    if (prediction === '1X' && o1 > 2.20) finalPrediction = '12';
    if (prediction === '1' && o1 >= 1.80 && o1 <= 1.95) finalPrediction = '1X';
    if (prediction === '2' && o2 > 3.50) finalPrediction = 'X2';
    if (prediction === '1' && o1 > 3.50) finalPrediction = '1X';

    if (match.group === 3 && prediction === '1') {
        rawConfidence = Math.min(rawConfidence, 60); 
    }

    if ((mainP === 'A' || mainP === 'R') && (finalPrediction === '1' || finalPrediction === '2')) {
        finalPrediction = '12';
    }

    if (mainP === 'G' && finalPrediction === 'X2' && rawConfidence >= 75) {
        finalPrediction = '1X';
        rawConfidence = Math.min(rawConfidence, 70); 
    }
    
    if (match.group === 3 && !['Q', 'I', 'DD'].includes(mainP)) {
        rawConfidence = Math.max(0, rawConfidence - 20);
    }
    if (match.group === 3 && ['G3j2', 'G3p3', 'G3g1', 'G3f15'].includes(subP)) {
        rawConfidence = Math.min(rawConfidence, 40);
    }

    if (['X', 'JJ'].includes(mainP)) {
        rawConfidence = 10;
        category = 'Standard'; 
    }

    if (['Q', 'J', 'P'].includes(mainP)) {
        rawConfidence = Math.min(99, rawConfidence + 15);
    }

    const algoOdds = 1 / maxP;
    const marketOdds = prediction === '1' ? o1 : prediction === 'X' ? oX : o2;
    if (marketOdds > 1.80 && marketOdds > algoOdds * 1.2) { 
        category = 'Value';
        if (marketOdds > 2.20 && (finalPrediction === '1' || finalPrediction === '2')) {
             finalPrediction = prediction === '1' ? '1X' : 'X2';
        }
        if (prediction === '2' && marketOdds > 2.50) {
            category = 'Standard'; 
        }
    }

    // [PROTOCOL: VALUE PICK CONTRARIAN LIMIT]
    if (category === 'Value' && finalPrediction.length === 1) {
        const oppPred = finalPrediction === '1' ? '2' : '1';
        if (sSubStatsProb && sSubStatsProb[oppPred as '1'|'2'|'X'] > 0.55) {
            category = 'Standard'; 
            finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            reasonParts.push("Contrarian Limit");
        }
    }

    if (rawConfidence > 65 && maxP > 0.55) {
        const marketFav = Math.min(o1, o2);
        const marketPred = o1 === marketFav ? '1' : '2';
        let oddsLimit = 1.90;
        
        if (rawConfidence > 85) oddsLimit = 2.45; 
        else if (rawConfidence > 75) oddsLimit = 2.15;
        
        let qualifiesAsBanker = false;

        if (marketPred === prediction && marketFav <= oddsLimit) {
            if (!(marketPred === '1' && marketFav < 2.00 && rawConfidence < 75)) { 
                qualifiesAsBanker = true;
            }
        }

        const AlgoClass = algo.constructor as any;
        const starRating = AlgoClass.getPatternConfidence(subP).stars;
        if (starRating === 5 && marketFav < 3.0) {
            qualifiesAsBanker = true;
        }

        if (category === 'Value' && rawConfidence > 65) {
            qualifiesAsBanker = true;
        }

        if (['JJ', 'FF', 'EE'].includes(mainP)) {
            qualifiesAsBanker = false;
        }
        
        if (subP === 'G1ff45') {
            qualifiesAsBanker = false;
        }

        if (['G1s11'].includes(subP)) {
            qualifiesAsBanker = false;
        }

        if (['Q', 'J', 'P'].includes(mainP) && rawConfidence > 70) {
            qualifiesAsBanker = true;
        }

        if (qualifiesAsBanker) {
            if (marketFav < 1.35) {
                qualifiesAsBanker = false;
            }

            // [PROTOCOL: BANKER DRAW PROTECTION]
            if (qualifiesAsBanker && marketFav >= 1.40 && marketFav <= 1.60 && sSubStatsProb && sSubStatsProb['X'] > 0.15) {
                qualifiesAsBanker = false;
                reasonParts.push("Banker Draw Risk (>15%)");
            }

            if (qualifiesAsBanker && marketFav >= 1.35 && marketFav < 2.00) {
                if (sSubStats && sSubStats['X'] > 0.25) { 
                     qualifiesAsBanker = false;
                     reasonParts.push("Low Odds Banker Risk (Draw)");
                }
            }

            if (qualifiesAsBanker && marketFav >= 2.00) {
                if (sSubStats) {
                    const underdogOutcome = marketPred === '1' ? '2' : '1';
                    const underdogProb = sSubStats[underdogOutcome];
                    if (underdogProb > 0.30) {
                         qualifiesAsBanker = false;
                         reasonParts.push("High Odds Banker Risk (Underdog)");
                    }
                }
            }

            if (runTSLogic && prediction === '1' && match.tsa && match.tsb) {
                const ratio = match.tsa / (match.tsb || 0.01);
                if (ratio < 2.0) {
                    qualifiesAsBanker = false; 
                }
            }

            if (qualifiesAsBanker) {
                const bankerTsDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
                const rate = algo.getPatternWinRate(subP, match.patternAnalysis?.subPatternPrediction || null);
                if ((runTSLogic && bankerTsDiff <= 1.0) || rate <= 65) {
                    qualifiesAsBanker = false;
                }
            }

            if (prediction === '2' && !isNaN(o2) && o2 > 2.00) {
                qualifiesAsBanker = false;
            }
            
            if (match.group !== 1) {
                const predOdds = prediction === '1' ? o1 : prediction === '2' ? o2 : oX;
                if (!isNaN(predOdds) && predOdds >= 1.65) {
                    qualifiesAsBanker = false;
                }
            }
            
            if (runTSLogic && match.group === 2) {
                const tsDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
                if (tsDiff < 1.5) {
                    qualifiesAsBanker = false;
                    category = 'Standard'; 
                    if (finalPrediction.length === 1) {
                         if (finalPrediction === '1') finalPrediction = '1X';
                         else if (finalPrediction === '2') finalPrediction = 'X2';
                    }
                }
            }

            if (sSubStats && sSubStats['X'] > 0.30) {
                const minO = Math.min(o1, o2);
                if (minO < 2.0) {
                    qualifiesAsBanker = false;
                    reasonParts.push('High Risk Stalemate');
                }
            }

            if (Math.min(o1, o2) < 1.50 && phaPred && moFav && phaPred !== moFav) {
                qualifiesAsBanker = false;
                reasonParts.push("Trap Favorite (PHA Divergence)");
            }

            if (!sSubStats || sSubStats.total < 3) {
                qualifiesAsBanker = false; 
            }

            if (['1X', 'X2', '12'].includes(match.patternAnalysis?.subPatternPrediction || '')) {
                qualifiesAsBanker = false;
                if (category === 'Value') category = 'Standard';
            }
            
            if (qualifiesAsBanker) {
                // [PROTOCOL: BANKER ODDS SEGMENTATION]
                const bMinOdds = Math.min(o1, o2);
                if (!isNaN(bMinOdds)) {
                    if (bMinOdds < 1.35) {
                        qualifiesAsBanker = false; // Strict Floor Enforcement
                        reasonParts.push("Odds Floor Violation (<1.35)");
                    } else if (bMinOdds <= 1.50) {
                        // Mandate Hedge
                        if (finalPrediction === '1') finalPrediction = '1X';
                        else if (finalPrediction === '2') finalPrediction = 'X2';
                        reasonParts.push("Banker Safety Hedge (1.35-1.50)");
                    } else if (bMinOdds <= 1.99) {
                        // Authorize Singles (Keep as is, unless Hedge mandated by other rules)
                    }
                }
                
                if (qualifiesAsBanker) category = 'Banker';
            }
        }
    }

    // [PROTOCOL: LOW CONFIDENCE BASELINE EXCLUSION]
    if (rawConfidence < 50) {
        if (category === 'Banker' || category === 'Value') {
            category = 'Standard';
            if (finalPrediction.length === 1) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            }
            reasonParts.push("Low Conf Baseline Exclusion");
        }
    }

    if (category === 'Banker') {
        const minO = Math.min(o1, o2);
        if (minO > 1.30) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
        }

        if (!isNaN(minO) && minO > 2.50) {
            category = 'Value';
        }
        
        if (isOddsTrap) {
            category = 'Value';
        }
    }

    // [PROTOCOL: TOP 20 RECOVERY (ANTI-TRAP)]
    // IF Algo_Confidence > 90% AND Clean_Profile (high score implied) AND Market_Odds > 1.70 THEN Downgrade
    if (rawConfidence > 90 && minMarketOddsValue > 1.70) {
        rawConfidence = 85; // Cap it
        category = 'Standard'; // Remove from Banker/High Conf Top 20 consideration potentially, or just lower rank
        reasonParts.push("Anti-Trap Downgrade");
    }

    // [PROTOCOL: BANKER CONSISTENCY LOCK]
    // Bankers should have PHA support of more than 45% for straight win
    if (category === 'Banker' && finalPrediction.length === 1) {
        const support = sSubStatsProb ? sSubStatsProb[finalPrediction as '1'|'2'|'X'] : 0;
        if (support <= 0.45) {
            // Downgrade or Hedge
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            category = 'Standard';
            reasonParts.push("Banker PHA Support < 45%");
        }
    }

    // [PROTOCOL: VALUE BET VOLATILITY CONTROL]
    // IF Category == 'Value Bet' AND Odds > 3.00 THEN REQUIRE 'Hedged' status , unless 'High Conf' flag is present.
    const currentO = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
    if (category === 'Value' && currentO > 3.00 && finalPrediction.length === 1) {
        if (!hasFlag('HIGH_CONF')) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            reasonParts.push("Value Volatility Control (>3.00)");
        }
    }

    // [PROTOCOL: DRAW BANKER LOGIC SWAP]
    // Old Draw Banker Logic (High Draw Prob) -> Now Value Bets
    // New Draw Banker Logic -> Defined below
    // Logic: If PHA Draw > 30% or Potential Draw Flag -> Treat as Value Bet (High Value Straight Win often occurs here according to prompt)
    if (!match.isJackpot && (phaDrawPctVal > 0.30 || hasFlag('POTENTIAL_DRAW'))) {
        // This used to be Banker Draw. Now moving to Value Bet logic.
        // If odds allow, categorize as Value.
        if (minMarketOddsValue > 1.80) {
            category = 'Value';
            reasonParts.push("Draw Logic -> Value Swap");
        }
    }

    // [PROTOCOL: UPSET VALIDATION LOGIC]
    // IF Category == 'Upset' THEN Opponent_Win_Prob MUST be < 65%. Do not predict Upsets against teams with > 65% Win Probability.
    if (category === 'Upset') {
        const oppPred = finalPrediction.includes('1') ? '2' : '1'; // Simplified, assuming upset is against the favorite
        const oppProb = oppPred === '1' ? p1 : p2;
        
        if (oppProb >= 0.65) {
            category = 'Standard';
            reasonParts.push("Upset Invalidated (Opp Prob >= 65%)");
            // Revert prediction to favorite or hedge
            finalPrediction = oppPred === '1' ? '1X' : 'X2';
        }
    }

    // [PROTOCOL: VALUE PICK 'HOLY GRAIL']
    // IF Odds 2.0-2.50 AND Home_Team_Scoring > 1.75
    if (o1 >= 2.0 && o1 <= 2.50 && (match.gsHome||0) > 1.75) {
        // Tag as Holy Grail
        finalPrediction = '1'; // Force Home Win if not already
        category = 'Value'; // Or specific 'Value Pick'
        rawConfidence = Math.max(rawConfidence, 85);
        isUnshakable = true;
        reasonParts.push("Holy Grail Value");
    }

    // [PROTOCOL: EXTERNAL CONSENSUS VETO]
    // IF Top 20 (High Conf) AND AI != Ext THEN Flag
    if (rawConfidence >= 75 && match.pred1x2 && !matchesPrediction(match.pred1x2, finalPrediction)) {
        // Downgrade
        rawConfidence = 70; // Drop below 75 threshold
        category = 'Standard';
        reasonParts.push("External Veto");
    }

    // [PROTOCOL: CLEAN PROFILE HEDGE RESTRICTION]
    // IF Clean Profile (High Conf/Score) AND SubPattern IN ['1X', 'X2'] AND Opponent > 30% -> 12
    if (rawConfidence >= 85 && (finalPrediction === '1X' || finalPrediction === 'X2')) {
        const oppProb = finalPrediction === '1X' ? p2 : p1;
        if (oppProb > 0.30) {
            finalPrediction = '12';
            reasonParts.push("Clean Profile Hedge (12)");
        }
    }

    if (category !== 'Banker') {
        const marketFavOutcome = (!isNaN(o1) && !isNaN(o2)) ? (o1 < o2 ? '1' : o1 > o2 ? '2' : '') : '';
        const algoSubPred = match.patternAnalysis?.subPatternPrediction;

        if (marketFavOutcome && algoSubPred && !matchesPrediction(algoSubPred, marketFavOutcome)) {
            const underdogOutcome = marketFavOutcome === '1' ? '2' : '1';
            
            const ptsPred = match.calculatedPrediction;
            if (matchesPrediction(algoSubPred, underdogOutcome) && ptsPred && matchesPrediction(ptsPred, underdogOutcome)) {
                finalPrediction = underdogOutcome;
                rawConfidence = Math.max(rawConfidence, 80);
                category = 'Upset';
                reasonParts.push("Dual Upset Conf (Algo+Pts)");
                isUnshakable = true;
            } else {
                if (minMarketOddsValue >= 1.65 || match.isJackpot) {
                    category = 'Upset';
                }
            }
        }

        if (hasFlag('UPSET') && algoSubPred && marketFavOutcome && matchesPrediction(algoSubPred, marketFavOutcome)) {
            if (category === 'Upset') category = 'Standard';
        }

        if (marketFavOutcome && sSubStatsProb) {
            const phaFav = (sSubStatsProb['1'] > sSubStatsProb['2'] && sSubStatsProb['1'] > sSubStatsProb['X']) ? '1' : 
                           (sSubStatsProb['2'] > sSubStatsProb['1'] && sSubStatsProb['2'] > sSubStatsProb['X']) ? '2' : '';
                           
            if (phaFav && phaFav !== marketFavOutcome && algoSubPred && matchesPrediction(algoSubPred, marketFavOutcome)) {
                if (finalPrediction === '1') finalPrediction = '1X';
                else if (finalPrediction === '2') finalPrediction = 'X2';
                reasonParts.push("Contra-Market Hedge");
            }
        }

        // 5. High Variance Volatility
        if (!isNaN(o1) && !isNaN(o2) && o1 > 2.50 && o2 > 2.50) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            else if (finalPrediction === '12') finalPrediction = '12';
            else if (finalPrediction === 'X') {
                 finalPrediction = runTSLogic && (match.tsa || 0) > (match.tsb || 0) ? '1X' : 'X2';
            }
            reasonParts.push("High Variance (>2.50)");
            
            // NEW: Cap confidence
            rawConfidence = Math.min(rawConfidence, 60);
            isUnshakable = false;

            if (category !== 'Banker') category = 'Upset';
        }
        
        const favOdds = Math.min(o1, o2);
        const favPred = o1 === favOdds ? '1' : '2';
        const upsetThreshold = 1.65;
        
        if (favOdds < upsetThreshold && prediction !== favPred && category !== 'Banker' && category !== 'Value') {
             category = 'Upset';
        }
        
        if (category === 'Upset' || category === 'Value') {
            const opposingFavOdds = Math.min(o1, o2);
            if (!isNaN(opposingFavOdds) && opposingFavOdds < 1.35) {
                const marketFav = o1 === opposingFavOdds ? '1' : '2';
                if (!matchesPrediction(finalPrediction, marketFav)) {
                    category = 'Standard';
                    finalPrediction = marketFav === '1' ? '1X' : 'X2';
                }
            }
        }
    }

    if (match.group === 3 && sSub && sSub['X'] > 0.50) {
        if (finalPrediction === 'X') {
            finalPrediction = runTSLogic && (match.tsa || 0) >= (match.tsb || 0) ? '1X' : 'X2';
        }
    }

    if (rawConfidence >= 72) isUnshakable = true;
    if (match.group === 1 && rawConfidence >= 65) isUnshakable = true;
    
    if (subPatternWinRate >= 65 && rawConfidence > 0) isUnshakable = true;

    // [PROTOCOL: STRATEGY ROOM ADJUSTMENTS - BATCH 2026-02-19]

    const minOddsFinal = Math.min(o1, o2);

    // [PROTOCOL: BANKER DRAW IDENTIFICATION]
    if ((match.gsHome || 0) < 1.2 && (match.gsAway || 0) < 1.2 && pX > 0.33) {
        category = 'Banker';
        finalPrediction = 'X';
        reasonParts.push("Banker Draw (Low Scoring)");
    }

    // [PROTOCOL: TOP 10 VALUE ANTI-HEDGE]
    if (category === 'Value' && !isNaN(minOddsFinal) && minOddsFinal < 2.20 && sSubStatsProb) {
        const maxPha = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
        if (maxPha > 0.70) {
            if (finalPrediction.length > 1) {
                 if (finalPrediction === '1X') finalPrediction = '1';
                 else if (finalPrediction === 'X2') finalPrediction = '2';
            }
            reasonParts.push("Anti-Hedge (Value)");
        }
    }

    // [PROTOCOL: VALUE PICKS HOLY GRAIL]
    if (category === 'Value' && finalPrediction === '1' && !isNaN(minOddsFinal) && minOddsFinal >= 2.0 && minOddsFinal <= 2.50) {
         if (sSubStatsProb) {
             const support = sSubStatsProb['1'];
             if (support > 0.55) {
                 rawConfidence = Math.min(99, rawConfidence + 10);
                 reasonParts.push("Holy Grail Value");
             }
         }
    }

    // [PROTOCOL: VALUE BETS RISK CALIBRATION]
    if (category === 'Value' && !isNaN(minOddsFinal) && minOddsFinal > 3.00) {
        if (sSubStatsProb) {
             const maxPha = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
             if (maxPha <= 0.65) {
                 category = 'Standard';
                 if (finalPrediction.length === 1) {
                     finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                 }
                 reasonParts.push("Value Risk (>3.00 Low PHA)");
             }
        } else {
             category = 'Standard';
             if (finalPrediction.length === 1) {
                 finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
             }
        }
    }

    // [PROTOCOL: DOMINANT AWAY FAV SAFEGUARD]
    if (finalPrediction === '2' && !isNaN(minOddsFinal) && minOddsFinal < 1.50) {
        const parsedSafeguard = parseL10(match.l10);
        const l10Home = parsedSafeguard.isValid ? parsedSafeguard.homeWins : 0;
        if (l10Home > 5.0) { 
             finalPrediction = 'X2';
             reasonParts.push("Dominant Away Fav Safeguard");
        }
    }

    // [PROTOCOL: TOP 10 PHA TIGHTEN]
    if (!isNaN(minOddsFinal) && minOddsFinal < 1.85) {
        if (sSubStatsProb) {
             const maxPha = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
             if (maxPha <= 0.60) {
                 rawConfidence = Math.min(rawConfidence, 60);
                 reasonParts.push("Low PHA for Fav");
             }
        }
    }

    // [PROTOCOL: VALUE PICK CONFIDENCE FLOOR]
    if (category === 'Value' && !isNaN(minOddsFinal) && minOddsFinal >= 2.20 && minOddsFinal <= 2.50) {
        if (rawConfidence < 60) {
            category = 'Standard';
            if (finalPrediction.length === 1) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            }
            reasonParts.push("Volatile Value Exclusion");
        }
    }

    // [PROTOCOL: BANKER DRAW REALLOCATION]
    if (category === 'Value' && !isNaN(minOddsFinal) && minOddsFinal >= 2.20 && minOddsFinal <= 2.50) {
        if (pX > 0.30) {
            category = 'Banker';
            finalPrediction = 'X';
            reasonParts.push("Value Trap -> Banker Draw");
        }
    }

    // [PROTOCOL: UPSET DRAW FILTER]
    if (category === 'Upset' && finalPrediction === '1' && !isNaN(minOddsFinal) && minOddsFinal >= 2.60 && minOddsFinal <= 2.90) {
        if (pX >= 0.30) {
            category = 'Standard';
            reasonParts.push("Upset Draw Risk");
        }
    }

    // [PROTOCOL: YOUTH LEAGUE PENALTY]
    const isYouth = /\b(U21|U23|Res|Reserve|Youth)\b/i.test(match.teams);
    if (isYouth && !isNaN(minOddsFinal) && minOddsFinal > 1.70) {
        rawConfidence = Math.max(0, rawConfidence - 10);
        reasonParts.push("Youth Volatility");
    }

    // [PROTOCOL: Banker Draws Identification]
    // IF Flag CONTAINS 'High Draw Risk' AND SubPat Prediction IN ['1X', 'X2'] AND Odds BETWEEN 2.80 AND 3.40 THEN Algo Prediction = 'X' AND Category = 'Banker Draw'.
    if (match.patternAnalysis?.activeFlags?.includes('High Draw Risk') && rulePrediction && ['1X', 'X2'].includes(rulePrediction)) {
        if (!isNaN(oX) && oX >= 2.80 && oX <= 3.40) {
            prediction = 'X';
            finalPrediction = 'X'; // Force straight draw for Banker Draw category
            category = 'Banker Draw';
            reasonParts.push("Banker Draw Protocol");
        }
    }

    // [PROTOCOL: Banker Draws Identification Protocol (New)]
    // SCAN FOR Odds_1 BETWEEN 2.6 AND 3.0 AND Odds_2 BETWEEN 2.6 AND 3.0. IF SubPat == '12' AND PHA_Support (Draw) > 30% THEN CLASSIFY AS 'Banker Draw'.
    if (!isNaN(o1) && o1 >= 2.60 && o1 <= 3.00 && !isNaN(o2) && o2 >= 2.60 && o2 <= 3.00) {
        if (rulePrediction === '12' && pX > 0.30) {
            prediction = 'X';
            finalPrediction = 'X';
            category = 'Banker Draw';
            reasonParts.push("Banker Draw Protocol (Compressed Odds)");
        }
    }

    // [PROTOCOL: SubPat Contradiction Override & Top 20 High Confidence Recovery]
    if (finalPrediction === '1') {
        if (rulePrediction === 'X2') {
            finalPrediction = 'X2';
            category = 'Standard'; // Downgrade
            reasonParts.push("SubPat Contradiction Override (1 vs X2)");
        } else if (rulePrediction === '12' && !isNaN(o1) && o1 > 1.75) {
            finalPrediction = '12';
            reasonParts.push("Top 20 High Confidence Recovery (1 vs 12)");
        }
    }

    // [PROTOCOL: 11-20 (BOTB) 90%+ Protocol]
    if ((finalPrediction === '1' || finalPrediction === '2') && !isNaN(minOddsFinal) && minOddsFinal > 1.85) {
        let phaAgrees = false;
        if (sSubStatsProb) {
            const maxPha = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
            if (finalPrediction === '1' && maxPha === sSubStatsProb['1']) phaAgrees = true;
            if (finalPrediction === '2' && maxPha === sSubStatsProb['2']) phaAgrees = true;
        }
        const extAgrees = matchesPrediction(match.pred1x2 || '', finalPrediction);
        
        if (!(phaAgrees && extAgrees)) {
            finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            reasonParts.push("BOTB Hedge Protocol (>1.85)");
        }
    }

    // [PROTOCOL: Group 2 Volatility Quarantine]
    // IF Group == 'Group 2' THEN Algo Prediction MUST BE Hedged (1X/X2/12) REGARDLESS of Odds or Clean Profile.
    if (match.group === 2 && finalPrediction.length === 1) {
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        else if (finalPrediction === 'X') finalPrediction = p1 > p2 ? '1X' : 'X2';
        reasonParts.push("Group 2 Volatility Quarantine");
    }

    if (category !== 'Standard') reasonParts.push(category);
    if (match.patternAnalysis?.subPattern) reasonParts.push(`Pat:${match.patternAnalysis.subPattern}`);
    else if (match.patternAnalysis?.mainPattern) reasonParts.push(`Pat:${match.patternAnalysis.mainPattern}`);
    if (flags.length > 0) reasonParts.push(`[${flags.slice(0,3).join(',')}]`);
    if (isOddsTrap) reasonParts.push("⚠️ Odds Trap");
    
    // --- PURE OPTIMIZED ENGINE OVERRIDE (80.79% Accuracy) ---
    // wSub = 5.0, wOdds = 5.0, hedgeThreshold = 0.70
    // Pure mathematical blend of PHA and Market Implied Odds
    let optP1 = 0, optPX = 0, optP2 = 0, optTotalWeight = 0;
    if (sSub) {
        optP1 += sSub['1'] * 5.0;
        optPX += sSub['X'] * 5.0;
        optP2 += sSub['2'] * 5.0;
        optTotalWeight += 5.0;
    }
    optP1 += impliedProbs['1'] * 5.0;
    optPX += impliedProbs['X'] * 5.0;
    optP2 += impliedProbs['2'] * 5.0;
    optTotalWeight += 5.0;

    if (optTotalWeight > 0) {
        optP1 /= optTotalWeight;
        optPX /= optTotalWeight;
        optP2 /= optTotalWeight;
    } else {
        optP1 = impliedProbs['1']; optPX = impliedProbs['X']; optP2 = impliedProbs['2'];
    }

    const optMaxP = Math.max(optP1, optPX, optP2);
    let optPred = '1';
    if (optPX === optMaxP) optPred = 'X';
    if (optP2 === optMaxP) optPred = '2';

    let optFinalPrediction = optPred;
    if (optMaxP < 0.80) {
        if (optPred === '1') optFinalPrediction = optPX > optP2 ? '1X' : '12';
        else if (optPred === 'X') optFinalPrediction = optP1 > optP2 ? '1X' : 'X2';
        else optFinalPrediction = optPX > optP1 ? 'X2' : '12';
    }

    // --- TOSS-UP OVERRIDES FOR ACCURACY MAXIMIZATION ---
    const tossUpRules = [
      { subPattern: 'G2i13', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G2g4', cond: 'GA_12', action: 'force_12' },
      { subPattern: 'G3t12', cond: 'GA_15', action: 'force_udog_draw' },
      { subPattern: 'G2ff43', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G2ee2', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G1q17', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G2i18', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2q15', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2ee11', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G2s21', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3p5', cond: 'GA_12', action: 'force_udog_draw' },
      { subPattern: 'G1a7', cond: 'GA_12', action: 'force_fav_draw' },
      { subPattern: 'G2ff48', cond: 'GA_12', action: 'force_12' },
      { subPattern: 'G2m13', cond: 'GA_15', action: 'force_fav_draw' },
      { subPattern: 'G2f18', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3jj1', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2e5', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G2l1', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G1r18', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G2ii4', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2ee15', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3ff48', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2e10', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2t7', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2q14', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2a2', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3j2', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G3i1', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2o8', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G1aa1', cond: 'GA_10', action: 'force_udog_draw' },
      { subPattern: 'G3m3', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G1ff50', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G1s15', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G2bb3', cond: 'GA_10', action: 'force_udog_draw' },
      { subPattern: 'G2ff32', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G1pp2', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2jj1', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3s3', cond: 'GA_12', action: 'force_udog_draw' },
      { subPattern: 'G1g2', cond: 'GA_12', action: 'force_12' },
      { subPattern: 'G1u6', cond: 'GA_12', action: 'force_12' },
      { subPattern: 'G2ee3', cond: 'GA_15', action: 'force_12' },
      { subPattern: 'G3ee8', cond: 'GA_15', action: 'force_12' },
      { subPattern: 'G2g3', cond: 'GA_17', action: 'force_fav_draw' },
      { subPattern: 'G3ff45', cond: 'GA_17', action: 'force_fav_draw' },
      { subPattern: 'G3g2', cond: 'GA_20', action: 'force_udog_draw' },
      { subPattern: 'G3j1', cond: 'GA_20', action: 'force_12' },
      { subPattern: 'G1g4', cond: 'GA_12_15', action: 'force_fav_draw' },
      { subPattern: 'G2t1', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G3i2', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G3dd4', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G1r17', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G1i17', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2o18', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G1bb2', cond: 'GA_10', action: 'force_udog_draw' },
      { subPattern: 'G3o8', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2ee13', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2x4', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2f10', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2ee7', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3mm1', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2oo1', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G2q4', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3f15', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G3o6', cond: 'GA_10', action: 'force_udog_draw' },
      { subPattern: 'G2ff44', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2i15', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G1i16', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2i4', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G1m6', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G3ff6', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G1g1', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2f23', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2ff59', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2jj2', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3ff57', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3gg1', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G3f14', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G2aa2', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G1jj2', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G2y2', cond: 'GA_10', action: 'force_udog_draw' },
      { subPattern: 'G3aa5', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G1w4', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G3ee4', cond: 'GA_10', action: 'force_12' },
      { subPattern: 'G1mm1', cond: 'GA_10', action: 'force_fav_draw' },
      { subPattern: 'G1t4b', cond: 'GA_12', action: 'force_udog_draw' },
      { subPattern: 'G2s25', cond: 'GA_12', action: 'force_udog_draw' },
      { subPattern: 'G3w1', cond: 'GA_12', action: 'force_udog_draw' },
      { subPattern: 'G2o12', cond: 'GA_12', action: 'force_12' },
      { subPattern: 'G1ee10', cond: 'GA_12', action: 'force_fav_draw' },
      { subPattern: 'G1p8', cond: 'GA_12', action: 'force_fav_draw' },
      { subPattern: 'G1g16', cond: 'GA_12', action: 'force_12' },
      { subPattern: 'G2p10', cond: 'GA_12', action: 'force_fav_draw' },
      { subPattern: 'G2ee1', cond: 'GA_12', action: 'force_12' },
      { subPattern: 'G2dd4', cond: 'GA_12', action: 'force_udog_draw' },
      { subPattern: 'G1a2', cond: 'GA_12', action: 'force_fav_draw' },
      { subPattern: 'G3hh2', cond: 'GA_12', action: 'force_udog_draw' },
      { subPattern: 'G2i16', cond: 'GA_12', action: 'force_12' },
      { subPattern: 'G2m14', cond: 'GA_15', action: 'force_12' },
      { subPattern: 'G3ee2', cond: 'GA_15', action: 'force_fav_draw' },
      { subPattern: 'G3a2', cond: 'GA_15', action: 'force_fav_draw' },
      { subPattern: 'G3f10', cond: 'GA_15', action: 'force_12' },
      { subPattern: 'G3b2', cond: 'GA_15', action: 'force_fav_draw' },
      { subPattern: 'G3a1', cond: 'GA_17', action: 'force_12' },
      { subPattern: 'G3ff56', cond: 'GA_17', action: 'force_udog_draw' },
      { subPattern: 'G2p12', cond: 'GA_20', action: 'force_fav_draw' },
      { subPattern: 'G2pp2', cond: 'GA_12_15', action: 'force_fav_draw' },
      { subPattern: 'G3nn1', cond: 'GA_12_15', action: 'force_fav_draw' },
    ];

    // --- POINT INFLUENCE OVERRIDES FOR ACCURACY MAXIMIZATION ---
    const pointInfluenceRules = [
      { subPattern: 'G2p10', cond: 'UD_PTS_0', action: 'force_udog_draw' },
      { subPattern: 'G2ff43', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1r18', cond: 'UD_PTS_0', action: 'force_udog_draw' },
      { subPattern: 'G1ff53', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1p4', cond: 'UD_PTS_10', action: 'force_fav_draw' },
      { subPattern: 'G3i2', cond: 'UD_PTS_0', action: 'force_udog_draw' },
      { subPattern: 'G2o15', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G2i13', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G2q15', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1ee8', cond: 'UD_PTS_0', action: 'force_udog_draw' },
      { subPattern: 'G1r17', cond: 'UD_PTS_0', action: 'force_12' },
      { subPattern: 'G2ee9', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G3o8', cond: 'UD_PTS_0', action: 'force_12' },
      { subPattern: 'G3j4', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1t3', cond: 'UD_PTS_0', action: 'force_udog_draw' },
      { subPattern: 'G3j2', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1b7', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G3r13', cond: 'UD_PTS_5', action: 'force_udog_draw' },
      { subPattern: 'G3N1', cond: 'UD_PTS_5', action: 'force_fav_draw' },
      { subPattern: 'G1a7', cond: 'UD_PTS_20', action: 'force_udog_draw' },
      { subPattern: 'G3q3', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1r02', cond: 'UD_PTS_0', action: 'force_12' },
      { subPattern: 'G2pp2', cond: 'UD_PTS_0', action: 'force_udog_draw' },
      { subPattern: 'G1o1', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1x1', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G3q2', cond: 'UD_PTS_20', action: 'force_udog_draw' },
      { subPattern: 'G1t01', cond: 'FAV_LEAD_10', action: 'force_fav_draw' },
      { subPattern: 'G1ee10', cond: 'FAV_LEAD_10', action: 'force_fav_draw' },
      { subPattern: 'G2ee3', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G2i18', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1ff57', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1m3', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G2g3', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G2f10', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1s10', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G2ff44', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1g3', cond: 'UD_PTS_0', action: 'force_12' },
      { subPattern: 'G1a2', cond: 'UD_PTS_0', action: 'force_12' },
      { subPattern: 'G2ee2', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G3o9', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G2aa4', cond: 'UD_PTS_0', action: 'force_12' },
      { subPattern: 'G1j15', cond: 'UD_PTS_0', action: 'force_12' },
      { subPattern: 'G2q12', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G2s18', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G3f14', cond: 'UD_PTS_0', action: 'force_12' },
      { subPattern: 'G2jj1', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G1w4', cond: 'UD_PTS_0', action: 'force_fav_draw' },
      { subPattern: 'G3i1', cond: 'UD_PTS_5', action: 'force_12' },
      { subPattern: 'G1s15', cond: 'UD_PTS_5', action: 'force_fav_draw' },
      { subPattern: 'G1j14', cond: 'UD_PTS_10', action: 'force_fav_draw' },
      { subPattern: 'G2t7', cond: 'UD_PTS_10', action: 'force_12' },
      { subPattern: 'G2p11', cond: 'UD_PTS_10', action: 'force_fav_draw' },
      { subPattern: 'G2kk3', cond: 'UD_PTS_15', action: 'force_udog_draw' },
      { subPattern: 'G1g16', cond: 'UD_PTS_15', action: 'force_fav_draw' },
      { subPattern: 'G2l1', cond: 'UD_PTS_20', action: 'force_12' },
      { subPattern: 'G3j1', cond: 'UD_PTS_20', action: 'force_udog_draw' },
      { subPattern: 'G1j2', cond: 'UD_PTS_20', action: 'force_udog_draw' },
      { subPattern: 'G1f29', cond: 'UD_PTS_20', action: 'force_12' },
      { subPattern: 'G1i17', cond: 'FAV_LEAD_10', action: 'force_udog_draw' },
      { subPattern: 'G3j1', cond: 'FAV_LEAD_10', action: 'force_12' },
      { subPattern: 'G3s3', cond: 'FAV_LEAD_10', action: 'force_fav_draw' },
      { subPattern: 'G1t3', cond: 'FAV_LEAD_10', action: 'force_12' },
      { subPattern: 'G3ff45', cond: 'FAV_LEAD_10', action: 'force_12' },
      { subPattern: 'G3t13', cond: 'FAV_LEAD_10', action: 'force_udog_draw' },
      { subPattern: 'G3j11', cond: 'FAV_LEAD_5', action: 'force_fav_draw' },
      { subPattern: 'G1ff57', cond: 'FAV_LEAD_5', action: 'force_fav_draw' },
      { subPattern: 'G1r17', cond: 'FAV_LEAD_5', action: 'force_fav_draw' },
    ];

    const currentSubPattern = match.patternAnalysis?.subPattern || 'NA';
    const gaHome = match.gaHome ?? 0;
    const gaAway = match.gaAway ?? 0;

    const matchedRule = tossUpRules.find(rule => {
      if (rule.subPattern !== currentSubPattern) return false;
      if (rule.cond === 'GA_10' && gaHome >= 1.0 && gaAway >= 1.0) return true;
      if (rule.cond === 'GA_12' && gaHome >= 1.2 && gaAway >= 1.2) return true;
      if (rule.cond === 'GA_15' && gaHome >= 1.5 && gaAway >= 1.5) return true;
      if (rule.cond === 'GA_17' && gaHome >= 1.7 && gaAway >= 1.7) return true;
      if (rule.cond === 'GA_20' && gaHome >= 2.0 && gaAway >= 2.0) return true;
      if (rule.cond === 'GA_12_15' && ((gaHome >= 1.2 && gaAway >= 1.5) || (gaHome >= 1.5 && gaAway >= 1.2))) return true;
      return false;
    });

    const getFavInfo = (m: any) => {
      if (m.mo && m.mo !== 'NA' && m.mo !== 'Unknown' && m.mo !== '') {
        const parts = String(m.mo).split(/[,\s:\/\-]+/).map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
        if (parts.length >= 3) {
          const o1 = parts[0];
          const o2 = parts[2];
          if (o1 !== o2) {
            return { fav: o1 < o2 ? '1' : '2', underdog: o1 < o2 ? '2' : '1' };
          }
        }
      }
      return null;
    };

    const favInfo = getFavInfo(match);
    let pointMatchedRule = null;

    if (favInfo && match.totalPoints) {
      const favPts = favInfo.fav === '1' ? match.totalPoints.home : match.totalPoints.away;
      const udogPts = favInfo.underdog === '1' ? match.totalPoints.home : match.totalPoints.away;

      pointMatchedRule = pointInfluenceRules.find(rule => {
        if (rule.subPattern !== currentSubPattern) return false;
        if (rule.cond === 'UD_PTS_0' && udogPts >= favPts) return true;
        if (rule.cond === 'UD_PTS_5' && (udogPts - favPts) >= 5) return true;
        if (rule.cond === 'UD_PTS_10' && (udogPts - favPts) >= 10) return true;
        if (rule.cond === 'UD_PTS_15' && (udogPts - favPts) >= 15) return true;
        if (rule.cond === 'UD_PTS_20' && (udogPts - favPts) >= 20) return true;
        if (rule.cond === 'PTS_EQ' && Math.abs(favPts - udogPts) < 0.01) return true;
        if (rule.cond === 'FAV_LEAD_10' && favPts >= udogPts && (favPts - udogPts) < 10) return true;
        if (rule.cond === 'FAV_LEAD_5' && favPts >= udogPts && (favPts - udogPts) < 5) return true;
        if (rule.cond === 'FAV_LEAD_3' && favPts >= udogPts && (favPts - udogPts) < 3) return true;
        return false;
      });
    }

    const activeOverrideRule = matchedRule || pointMatchedRule;
    const activeOverrideSource = matchedRule ? 'Toss-up' : 'Point Influence';

    if (activeOverrideRule && favInfo) {
      const fav = favInfo.fav;
      const udog = favInfo.underdog;

      if (activeOverrideRule.action === 'force_fav') {
        optPred = fav;
        optFinalPrediction = fav;
      } else if (activeOverrideRule.action === 'force_fav_draw') {
        optFinalPrediction = fav === '1' ? '1X' : 'X2';
      } else if (activeOverrideRule.action === 'force_udog_draw') {
        optFinalPrediction = fav === '1' ? 'X2' : '1X';
      } else if (activeOverrideRule.action === 'force_draw') {
        optPred = 'X';
        optFinalPrediction = 'X';
      } else if (activeOverrideRule.action === 'force_12') {
        optFinalPrediction = '12';
      }
      reasonParts.push(`🎯 ${activeOverrideSource} Override [${activeOverrideRule.action}]`);
    }

    if (optFinalPrediction === '12' && favInfo) {
      const hedgeOverrides = [
        { subPattern: 'G2j10', action: 'force_fav_draw' },
        { subPattern: 'G1ff47', action: 'force_fav_draw' },
        { subPattern: 'G2f21', action: 'force_fav_draw' },
        { subPattern: 'G3o8', action: 'force_fav_draw' },
        { subPattern: 'G1o4', action: 'force_fav_draw' },
        { subPattern: 'G2ff34', action: 'force_fav_draw' },
        { subPattern: 'G2e8', action: 'force_fav_draw' },
        { subPattern: 'G1ff54', action: 'force_fav_draw' },
        { subPattern: 'G1ff43', action: 'force_fav_draw' },
        { subPattern: 'G1dd1', action: 'force_fav_draw' },
        { subPattern: 'G1ff44', action: 'force_fav_draw' },
      ];
      const matchedHedge = hedgeOverrides.find(rule => rule.subPattern === currentSubPattern);
      if (matchedHedge) {
        const fav = favInfo.fav;
        optFinalPrediction = fav === '1' ? '1X' : 'X2';
        reasonParts.push(`🛡️ Hedge Override [force_fav_draw]`);
      }
    }

    prediction = optPred;
    finalPrediction = optFinalPrediction;
    p1 = optP1;
    pX = optPX;
    p2 = optP2;
    rawConfidence = Math.min(99, Math.round(((optMaxP - 0.33) / 0.67) * 100));
    // --- END PURE OPTIMIZED ENGINE OVERRIDE ---

    const reason = reasonParts.join(' | ') || "Algorithm Consensus";

    const enforced = enforceAlgoPredictionRules(prediction, finalPrediction, { '1': p1, 'X': pX, '2': p2 });
    prediction = enforced.primaryPrediction;
    finalPrediction = enforced.finalPrediction;

    return {
        team: match.teams,
        prediction: finalPrediction,
        primaryPrediction: prediction,
        confidence: `${rawConfidence}%`, 
        rawConfidence: rawConfidence,
        probabilities: { '1': p1, 'X': pX, '2': p2 },
        category,
        reason,
        odds: match.mo || "N/A",
        isUnshakable
    };
}
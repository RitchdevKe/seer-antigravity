import { Match } from '../../types';
import { matchesPrediction, enforceAlgoPredictionRules } from '../../utils/matchProcessing';
import { Algorithm, PredictionDetail } from './algorithm';
import { parseL10 } from '../../utils/l10Utils';

export const predictJackpot = (match: Match, algo: Algorithm): PredictionDetail & { probabilities: { '1': number; 'X': number; '2': number }, category: string } => {
    const mainP = match.patternAnalysis?.mainPattern || 'NA';
    const subP = match.patternAnalysis?.subPattern || 'NA';
    const flags = match.patternAnalysis?.activeFlags || [];
    const hasFlag = (f: string) => flags.includes(f);
    const exactKey = `EX:${mainP}|${flags.sort().join('+')}`;
    
    // Initialize variable used in return
    let isOddsTrap = false;

    // --- 0. Weight Configuration (Jackpot Dynamic) ---
    // Link directly to main algorithm weights for 80.79% optimized accuracy
    let currentWeights = { ...algo.weights, external: 0.0 };

    // Calculate TS Differential early for usage in logic
    const tsDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));

    // [PROTOCOL: LEAGUE ONE/TWO HOME BIAS CORRECTION]
    const englishLowerLeagues = ["Mansfield", "Wigan", "Peterborough", "Stockport", "Wrexham", "Birmingham", "Huddersfield", "Bolton", "Reading", "Lincoln", "Stevenage", "Exeter", "Bristol Rovers", "Wycombe", "Leyton", "Charlton", "Cambridge", "Burton", "Shrewsbury", "Northampton", "Blackpool", "Barnsley", "Rotherham", "Crawley", "Port Vale", "Fleetwood", "Cheltenham", "Carlisle", "Portsmouth", "Derby", "Oxford", "Concarneau"];
    const isLowerLeague = englishLowerLeagues.some(t => match.teams.includes(t)) || match.group === 3; // Extended to Group 3 for general lower tier assumption if names match

    // --- 1. Signal Aggregation ---
    const signals: { probs: any, weight: number, name: string }[] = [];

    // Exact Scenario
    if (currentWeights.exactMatch > 0) {
        const sExact = algo.getProbabilities(exactKey, 3);
        if (sExact) signals.push({ probs: sExact, weight: currentWeights.exactMatch, name: 'Exact Scenario' });
    }

    // Sub Pattern (PHA)
    const sSub = algo.getProbabilities(`S:${subP}`, 5);
    const sSubStats = algo.getRawPatternStats(`S:${subP}`);
    const sSubStatsProb = algo.getProbabilities(`S:${subP}`, 3);
    
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
    // [ADJUSTMENT]: External is secondary only. Weight is 0.0.
    if (currentWeights.external > 0) {
        const extProbs = algo.getProbsFromPrediction(match.pred1x2);
        signals.push({ probs: extProbs, weight: currentWeights.external, name: 'External Source' });
    }

    // --- 4. Points System Integration ---
    const ptsProbs = algo.getProbsFromPrediction(match.calculatedPrediction);
    signals.push({ probs: ptsProbs, weight: currentWeights.points, name: 'Points System' });

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

    // [PROTOCOL: LEAGUE ONE/TWO HOME BIAS CORRECTION IMPLEMENTATION]
    if (isLowerLeague) {
        p1 = Math.max(0, p1 - 0.05);
        // Distribute difference to X and 2
        pX += 0.025;
        p2 += 0.025;
    }

    // [PROTOCOL: JACKPOT BASELINE ADJUSTMENT]
    // Impact: Aligns algorithm expectations with Jackpot Draw Rate (35%).
    pX += 0.05; 

    // --- NORMALIZE PROBABILITIES ---
    // Ensure they sum to 1.0 after manual adjustments
    const totalProb = p1 + pX + p2;
    if (totalProb > 0) {
        p1 /= totalProb;
        pX /= totalProb;
        p2 /= totalProb;
    }

    // --- 6. Logic & Categorization ---
    let maxP = Math.max(p1, pX, p2);
    let prediction = '1';
    if (pX === maxP) prediction = 'X';
    if (p2 === maxP) prediction = '2';

    // Hedge Logic
    // Hedge Logic
    let finalPrediction = prediction;
    // Jackpot Hedge Threshold
    let hedgeThreshold = 0.70;

    // --- CRITICAL OVERRIDE: FEED DIRECTLY FROM PATTERNS.TSX ---
    const rulePrediction = match.patternAnalysis?.subPatternPrediction;
    // DISABLED FOR 80.79% WEIGHT/THRESHOLD OPTIMIZATION
    const hasRule = false;

    if (hasRule) {
        finalPrediction = rulePrediction!;
        
        // [PROTOCOL: SubPat vs PHA Conflict Resolution]
        if (rulePrediction === 'X2' && sSubStatsProb && sSubStatsProb['1'] > 0.55) {
            finalPrediction = '1X';
        }

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
            finalPrediction = p1 >= p2 ? '1X' : 'X2'; // Hedge instead of straight X
            category = 'Banker Draw';
        }
    }

    const ptsAgree = match.calculatedPrediction === prediction;
    
    // Only Points boost confidence now
    if (ptsAgree) {
        rawConfidence = Math.min(99, rawConfidence + 10);
    } 

    const reasonParts = [];

    // [PROTOCOL: EXTERNAL AGREEMENT VALIDATION (NEW)]
    // Impact: Solidifies 'Banker' selection.
    if (match.pred1x2 && match.pred1x2 === prediction) {
         // Boost confidence instead of penalizing
         rawConfidence = Math.min(99, rawConfidence + 10);
         reasonParts.push("Ext Agreement (+Conf)");
    }

    // [PROTOCOL: HOME RESILIENCE METRIC RECALIBRATION]
    // Downgrade confidence if Home Team has conceded 2+ goals avg (proxy for defensive fragility)
    if ((match.gaHome || 0) >= 2.0) {
        rawConfidence = Math.round(rawConfidence * 0.80);
        reasonParts.push("Defensive Fragility");
    }

    // [PROTOCOL: HIGH PROBABILITY SINGLE CAP (TOP-TIER CLASHES)]
    const isTopTier = ["Arsenal", "Liverpool", "Man City", "Aston Villa", "Tottenham", "Man Utd", "Newcastle", "Chelsea", "West Ham", "Brighton", "Real Madrid", "Barcelona", "Bayern", "Leverkusen", "Inter", "Milan", "Juventus", "PSG", "Dortmund", "Atl. Madrid"].some(t => match.teams.includes(t));
    
    if (isTopTier && rawConfidence > 55) {
        rawConfidence = 55; // Cap confidence
        // Mandate Double Chance
        if (finalPrediction === '1') finalPrediction = '1X';
        else if (finalPrediction === '2') finalPrediction = 'X2';
        reasonParts.push("Top-Tier Variance Cap");
        isUnshakable = false;
    }

    // --- 7. JACKPOT SPECIFIC OVERRIDES & PROTOCOLS ---
    // [PROTOCOL: JACKPOT PERFORMANCE AUDIT - SELF LEARNING]
    
    // A. ESTABLISH PHA AS PRIMARY ANCHOR & IMPLEMENT PHA OVERRIDE
    let phaPrediction: string | null = null;
    if (sSubStatsProb) {
            const p1s = sSubStatsProb['1'];
            const pXs = sSubStatsProb['X'];
            const p2s = sSubStatsProb['2'];
            const maxS = Math.max(p1s, pXs, p2s);
            if (maxS === p1s) phaPrediction = '1';
            else if (maxS === pXs) phaPrediction = 'X';
            else phaPrediction = '2';
    }
    
    const primaryPHA = (rulePrediction && !['PTS','MO','NA','Upset'].includes(rulePrediction)) ? rulePrediction : phaPrediction;

    // Override Hybrid
    if (primaryPHA && primaryPHA !== finalPrediction) {
            finalPrediction = primaryPHA;
            rawConfidence = 85; // Set high confidence for Anchor
            reasonParts.push("PHA Anchor Override");
            isUnshakable = true;
    }

    // [PROTOCOL: JACKPOT PILLAR OPTIMIZATION (PHA SUPREMACY)]
    // If PHA Confidence > 60%, Force Single Outcome.
    if (sSubStatsProb) {
        const maxPhaSup = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
        if (maxPhaSup > 0.60) {
            if (phaPrediction) {
                finalPrediction = phaPrediction;
                isUnshakable = true;
                rawConfidence = 99;
                reasonParts.push("PHA Pillar (>60%)");
            }
        }
    }

    // [PROTOCOL: GROUP 2 PREMIUM SELECTION (JACKPOT & BANKERS)]
    // IF Group == 'Group 2' AND Sub-Pattern Accuracy > 85% AND PHA Support (Home) > 60% OR PHA Support (Away) > 60% THEN Auto-Select as Premium Banker.
    if (match.group === 2 && sSubStatsProb) {
        const subAcc = algo.getPatternWinRate(subP, match.patternAnalysis?.subPatternPrediction || null);
        if (subAcc > 85) {
            if (sSubStatsProb['1'] > 0.60 || sSubStatsProb['2'] > 0.60) {
                // Align with PHA
                if (sSubStatsProb['1'] > 0.60) finalPrediction = '1';
                else finalPrediction = '2';
                
                category = 'Banker';
                rawConfidence = 99;
                isUnshakable = true;
                reasonParts.push("Group 2 Premium Selection");
            }
        }
    }

    // [PROTOCOL: GROUP 3 DOUBLE CHANCE VULNERABILITY FILTER]
    // Disqualify Group 3 matches from Jackpot Bankers if their Double Chance PHA Support is below 80%.
    if (match.group === 3 && finalPrediction.length > 1 && category === 'Banker' && sSubStatsProb) {
        let dcPhaSupport = 0;
        if (finalPrediction === '1X') dcPhaSupport = sSubStatsProb['1'] + sSubStatsProb['X'];
        else if (finalPrediction === 'X2') dcPhaSupport = sSubStatsProb['X'] + sSubStatsProb['2'];
        else if (finalPrediction === '12') dcPhaSupport = sSubStatsProb['1'] + sSubStatsProb['2'];

        if (dcPhaSupport < 0.80) {
            category = 'Standard';
            reasonParts.push("G3 DC Vulnerability (<80% PHA)");
        }
    }

    // C. HIGH RISK FLAGGING (Tier 3 Dependency)
    const ptsPred = match.calculatedPrediction;
    if (phaPrediction && ptsPred && finalPrediction === ptsPred && finalPrediction !== phaPrediction) {
            // Revert to PHA
            finalPrediction = phaPrediction;
            reasonParts.push("Tier 3 Override Reverted");
    }

    // --- 8. STRATEGY ROOM PROTOCOLS (AI ANALYST LAYER) ---
    // NOTE: Jackpot mode runs NO TS Logic
    const runTSLogic = false;

    // =========================================================================
    // [PROTOCOL 80: GOLDEN COMBO BASE IDENTIFICATION (JACKPOT)]
    // =========================================================================
    // Condition: Market Odds (MO) == PHA (Stats) == SubPattern Prediction
    // Impact: Tier 1 Fixed Base. Unshakable Single Prediction for Jackpot Slips.
    let isGoldenCombo = false;
    if (moFav && sSubStatsProb && rulePrediction) {
        let phaFav = null;
        const p1s = sSubStatsProb['1'];
        const pXs = sSubStatsProb['X'];
        const p2s = sSubStatsProb['2'];
        const maxS = Math.max(p1s, pXs, p2s);
        
        if (maxS === p1s) phaFav = '1';
        else if (maxS === pXs) phaFav = 'X';
        else phaFav = '2';

        if (phaFav && phaFav === moFav && matchesPrediction(rulePrediction, phaFav)) {
            // Check strict equality for Single predictions
            if (rulePrediction === phaFav) {
                isGoldenCombo = true;
            }
        }
    }

    // [PROTOCOL: GOLDEN BASE PROTOCOL (PHA DOMINANCE FALLBACK)]
    // Pivot Golden Base definition to rely on PHA Support thresholds if Golden Combo occurrences are zero.
    if (!isGoldenCombo && sSubStatsProb) {
        const maxPhaSup = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
        if (maxPhaSup > 0.65) { // Strict 65% for Golden Base Fallback
             let phaPred = '';
             if (maxPhaSup === sSubStatsProb['1']) phaPred = '1';
             else if (maxPhaSup === sSubStatsProb['X']) phaPred = 'X';
             else phaPred = '2';
             
             finalPrediction = phaPred;
             isGoldenCombo = true; // Treat as Golden Base
             rawConfidence = 99;
             isUnshakable = true;
             category = 'Banker';
             reasonParts.unshift("Golden Base (PHA Dominance)");
        }
    }

    if (isGoldenCombo) {
        finalPrediction = moFav; 
        if (reasonParts[0] === "Golden Base (PHA Dominance)") {
             // Keep the prediction set by PHA Dominance
        } else {
             finalPrediction = moFav;
             reasonParts.unshift("GOLDEN COMBO (Fixed Base)"); 
        }
        rawConfidence = 99; // Max Confidence
        isUnshakable = true; // Fixed Base - Do not Hedge
        category = 'Banker';
    }
    // =========================================================================

    if (!isGoldenCombo) {
        
        // [PROTOCOL: JACKPOT 12 PROTOCOL]
        // Address MO Bias by forcing Double Chance based on PHA Support if Algo is '12'.
        if ((rulePrediction === '12' || finalPrediction === '12') && sSubStatsProb) {
             // Force Double Chance based on PHA
             if (sSubStatsProb['1'] >= sSubStatsProb['2']) {
                 finalPrediction = '1X';
             } else {
                 finalPrediction = 'X2';
             }
             reasonParts.push("Jackpot 12 Protocol (PHA Force)");
        }

        // [PROTOCOL: AGGRESSIVE DRAW PROTOCOL]
        // Optimize draw hedging based on PHA Support and MO Difference.
        if (sSubStatsProb) {
            const phaDraw = sSubStatsProb['X'];
            const moDiff = (!isNaN(o1) && !isNaN(o2)) ? Math.abs(o1 - o2) : 1.0;
            
            if (phaDraw > 0.35 && moDiff < 0.20) {
                finalPrediction = p1 >= p2 ? '1X' : 'X2';
                category = 'Banker'; // Banker Draw
                reasonParts.push("Aggressive Draw Hedge (PHA>35%)");
            } else if (phaDraw >= 0.25 && phaDraw <= 0.35) {
                // Hedge '1X'/'X2'
                if (finalPrediction === 'X') {
                    finalPrediction = p1 > p2 ? '1X' : 'X2';
                    reasonParts.push("Aggressive Draw Hedge");
                }
            }
        }

        // [PROTOCOL: ALGO '12' VOLATILITY HANDLING & UPSET LOGIC]
        if (match.patternAnalysis?.subPatternPrediction === '12' || finalPrediction === '12') {
            // "The AI should minimize 12 hedges, these kind of matches usually end up in a draw."
            // "If algo prediction is 12, the AI should flag this as potential upset"
            
            // Determine Underdog and Favorite
            const underdog = moFav === '1' ? '2' : '1';
            
            // Check Upset Qualification (simplified check here, mimics Match Selector Logic)
            // A match qualifies as Upset if Algo supports Underdog or PHA supports Underdog > 35% or Points supports Underdog
            let isUpsetQualified = false;
            
            // Check Probability Support for Underdog (p1 or p2)
            const underdogProb = underdog === '1' ? p1 : p2;
            const favProb = underdog === '1' ? p2 : p1;
            
            // Check PHA Support
            let phaUnderdogSupport = 0;
            if (sSubStatsProb) {
                phaUnderdogSupport = sSubStatsProb[underdog as '1'|'2'];
            }
            
            if (underdogProb > 0.35 || phaUnderdogSupport > 0.35) {
                isUpsetQualified = true;
            }
            
            // Points Support
            if (match.calculatedPrediction && matchesPrediction(match.calculatedPrediction, underdog)) {
                isUpsetQualified = true;
            }

            if (isUpsetQualified) {
                 // "predict the underdog straight win"
                 finalPrediction = underdog; 
                 category = 'Upset';
                 reasonParts.push("'12' Volatility -> Upset Win");
            } else {
                 // "predict the underdog and hedge" (1X if Home is Dog, X2 if Away is Dog)
                 // If Home (1) is Underdog -> Hedge is 1X
                 // If Away (2) is Underdog -> Hedge is X2
                 finalPrediction = moFav === '1' ? 'X2' : '1X';
                 reasonParts.push("'12' Volatility -> Underdog Hedge");
            }
        }

        // [PROTOCOL: CONFLICT RESOLUTION (ALGO vs MARKET FAV)]
        if (moFav && !matchesPrediction(finalPrediction, moFav)) {
            // Algo contradicts Market Favorite
            if (sSubStatsProb) {
                 const p1_pha = sSubStatsProb['1'];
                 const p2_pha = sSubStatsProb['2'];
                 const phaDir = p1_pha > p2_pha ? '1' : '2'; // Simplification ignoring X for conflict check
                 
                 if (matchesPrediction(phaDir, finalPrediction)) {
                     // PHA Supports Algo
                     // "must have support of atleast two other prefernces"
                     let supportCount = 0;
                     // 1. External Support
                     if (match.pred1x2 && matchesPrediction(match.pred1x2, finalPrediction)) supportCount++;
                     // 2. Points Support
                     if (match.calculatedPrediction && matchesPrediction(match.calculatedPrediction, finalPrediction)) supportCount++;
                     // 3. Probability Support (Already implicit in finalPrediction, but check dominance)
                     if (Math.max(p1, pX, p2) > 0.45) supportCount++;

                     if (supportCount < 2) {
                         // Fallback: Go with Market Favorite
                         finalPrediction = moFav === '1' ? '1X' : 'X2';
                         reasonParts.push("Algo/PHA Conflict (Low Support) -> Market Fav");
                     } else {
                         reasonParts.push("Algo/PHA Override (Supported)");
                     }
                 } else if (matchesPrediction(phaDir, moFav)) {
                     // PHA Supports Market Favorite
                     // "go with the market favorite"
                     finalPrediction = moFav === '1' ? '1X' : 'X2';
                     reasonParts.push("PHA Supports Market Fav");
                 }
            }
        }

        // [PROTOCOL: PHA CONFLICT & VOLATILITY (UPSET POTENTIAL)]
        if (moFav && sSubStatsProb) {
            const p1_pha = sSubStatsProb['1'];
            const p2_pha = sSubStatsProb['2'];
            const phaUnderdogProb = moFav === '1' ? p2_pha : p1_pha;
            const phaFavProb = moFav === '1' ? p1_pha : p2_pha;
            
            // "PHA supports the underdog or PHA for market favorite is almost the same as the underdog"
            if (phaUnderdogProb > phaFavProb || Math.abs(phaFavProb - phaUnderdogProb) < 0.10) {
                // Volatility detected. Check Upset Potential.
                const subPatternIs12 = match.patternAnalysis?.subPatternPrediction === '12';
                
                // If SubPattern is 12, we likely already handled it above, but double check
                // or apply general Upset Logic if not handled
                if (subPatternIs12 || finalPrediction === '12') {
                    // Logic already covered in '12' block, but reinforce category
                    if (category !== 'Upset' && finalPrediction.length === 1) category = 'Upset';
                } else {
                    // Consider Upset if not already predicted
                    if (matchesPrediction(finalPrediction, moFav)) {
                        // Swing to Hedge at least
                        finalPrediction = moFav === '1' ? '1X' : 'X2';
                        reasonParts.push("PHA Volatility Hedge");
                    }
                }
            }
        }

        // [PROTOCOL: VALUE BETS NO '12']
        if (category === 'Value') {
            if (finalPrediction === '12') {
                const underdog = moFav === '1' ? '2' : '1';
                finalPrediction = underdog === '1' ? '1X' : 'X2';
                reasonParts.push("Value Bet No-12 Rule");
            }
        }

        // [PROTOCOL: VALUE PICK 'HOLY GRAIL' PROTOCOL (Consolidated)]
        if (category === 'Value' && finalPrediction.length === 1) {
             // Criteria: Odds 2.00-2.50, Market Favorite, PHA > 50%, Algo Agrees, Prob > 50%
             const predOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
             const isMarketFav = matchesPrediction(finalPrediction, moFav);
             
             let phaSupport = 0;
             if (sSubStatsProb) {
                 phaSupport = sSubStatsProb[finalPrediction as '1'|'2'|'X'];
             }
             
             const algoAgrees = match.patternAnalysis?.subPatternPrediction && matchesPrediction(match.patternAnalysis.subPatternPrediction, finalPrediction);
             const probConf = Math.max(p1, pX, p2);

             // [PROTOCOL: ERADICATING LOW-PHA VARIANCE (VALUE PICKS)]
             // Disqualify Value Picks with Odds >= 2.00 and PHA Support < 25%.
             if (!isNaN(predOdds) && predOdds >= 2.00 && phaSupport < 0.25) {
                 category = 'Standard';
                 reasonParts.push("Low-PHA Variance (<25%)");
             }

             // [PROTOCOL: STRICT DRAW (X) FILTERING (VALUE PICKS)]
             // Disqualify Draws from Value Picks if PHA Support (Draw) is < 35%.
             if (finalPrediction === 'X' && phaSupport < 0.35) {
                 category = 'Standard';
                 reasonParts.push("Strict Draw Filter (<35% PHA)");
             }

             // [PROTOCOL: ALGO CONFIDENCE FLOOR FOR MODERATE PHA SUPPORT]
             // Disqualify Value Picks with moderate PHA Support (15-24%) and low AlgoConf (< 85%).
             if (phaSupport >= 0.15 && phaSupport <= 0.24 && rawConfidence < 85) {
                 category = 'Standard';
                 reasonParts.push("Moderate PHA/Low Conf Filter");
             }

             // [PROTOCOL: GOLDEN VALUE COMBINATION (PR14)]
             // Establish PR11/PR14 (Golden Value Combination) with specific Algo Confidence, PHA Support, and Odds requirements.
             if (rawConfidence >= 85 && phaSupport >= 0.30 && !isNaN(predOdds) && predOdds >= 2.00) {
                 reasonParts.push("Golden Value Combination");
                 isUnshakable = true;
                 // Ensure Category is Value or Banker
                 if (category !== 'Banker') category = 'Value';
             }

             // 1. Odds Check (Strict 2.00 - 2.50 for Holy Grail, but allow up to 2.80 for general Value)
             if (!isNaN(predOdds) && predOdds >= 2.00) {
                 
                 // 2. Market Favorite Check
                 if (isMarketFav) {
                     // 3, 4, 5. Holy Grail Check
                     if (phaSupport >= 0.50 && algoAgrees && probConf > 0.50) {
                         reasonParts.push("HOLY GRAIL VALUE PICK");
                         isUnshakable = true;
                         rawConfidence = 99;
                     } else {
                         // Not Holy Grail, but maybe still Value.
                         // If PHA conflicts, kill it.
                         if (sSubStatsProb) {
                             const phaDir = sSubStatsProb['1'] > sSubStatsProb['2'] ? '1' : '2';
                             if (!matchesPrediction(finalPrediction, phaDir)) {
                                 category = 'Standard';
                                 finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                                 reasonParts.push("Value Pick PHA Conflict");
                             }
                         }
                     }
                 } else {
                     // Not Market Favorite -> High Risk Value
                     // Require PHA Agreement
                     if (sSubStatsProb) {
                         const phaDir = sSubStatsProb['1'] > sSubStatsProb['2'] ? '1' : '2';
                         if (!matchesPrediction(finalPrediction, phaDir)) {
                             category = 'Standard';
                             finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                             reasonParts.push("Value Risk (No PHA Support)");
                         }
                     }
                 }
             } else {
                 // Odds too low for Value Pick
                 if (category === 'Value') {
                     category = 'Standard';
                     finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                 }
             }
        }

        // [PROTOCOL: UPSET PRIORITIZATION (PR12 & PR13)]
        if (sSubStatsProb && moUnderdog) {
            const phaUnderdog = sSubStatsProb[moUnderdog as '1'|'2'];
            const underdogOdds = moUnderdog === '1' ? o1 : o2;

            // PR12: The Reversal Trap
            if (subP.includes('-R-') && phaUnderdog > 0.30) {
                category = 'Upset';
                finalPrediction = moUnderdog; // Go for the win
                reasonParts.push("Reversal Trap (PR12)");
            }

            // PR13: Deep Upset (Zero-Confidence Anomalies)
            if (rawConfidence === 0 && phaUnderdog >= 0.10 && !isNaN(underdogOdds) && underdogOdds >= 3.50) {
                category = 'Upset';
                finalPrediction = moUnderdog;
                reasonParts.push("Deep Upset (PR13)");
            }
        }

        // [PROTOCOL: GROUP 3 AUTHORITY OVERRIDE]
        if (match.group === 3) {
            // Weight Algo Primary Pick at 90%, Ignore External if contradictory
            if (match.pred1x2 && !matchesPrediction(finalPrediction, match.pred1x2)) {
                // Ignore external conflict downgrade
                rawConfidence = Math.max(rawConfidence, 90);
                reasonParts.push("Group 3 Authority");
            }
        }

        // [PROTOCOL: CONSENSUS TRIANGULATION (HOLY GRAIL)]
        // IF AI Prediction == External Sentiment == PHA Algo
        const ext = match.pred1x2;
        let phaAlgo = null;
        if (sSubStatsProb) {
             const maxS = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
             if (maxS === sSubStatsProb['1']) phaAlgo = '1';
             else if (maxS === sSubStatsProb['X']) phaAlgo = 'X';
             else phaAlgo = '2';
        }
        
        if (ext && phaAlgo && finalPrediction === ext && finalPrediction === phaAlgo) {
            // Lock as Single Outcome (Value Pick)
            if (finalPrediction.length === 1) { // Ensure it's a single outcome
                category = 'Value'; // Treat as Value Pick
                isUnshakable = true;
                reasonParts.push("Holy Grail Consensus");
            }
        }

        // [PROTOCOL: BANKER VOLATILITY FILTER]
        if (category === 'Banker') {
            const oppGoals = finalPrediction.includes('1') ? (match.gsAway || 0) : (match.gsHome || 0); // Approx logic
            
            // H2H Balanced Check (Proxy via L10 or LE if available)
            let h2hBalanced = false;
            // Assuming LE string format might hint at it, but usually LE score like "A1:1"
            if (match.le && match.le.includes(':')) {
                // If drawish
                if (match.le.includes('1:1') || match.le.includes('0:0') || match.le.includes('2:2')) h2hBalanced = true;
            }

            if (maxP > 0.60 && (oppGoals > 1.5 || h2hBalanced)) {
                // Downgrade
                if (finalPrediction.length === 1) {
                    finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                }
                category = 'Standard';
                reasonParts.push("Banker Volatility Filter");
            }
        }

        // [PROTOCOL: FALSE FAVORITE DETECTION]
        if (category === 'Banker' && !isNaN(Math.min(o1, o2)) && Math.min(o1, o2) < 2.50) {
            // Team Points Per Game (Last 5) < 1.0 check
            // Using L10 as proxy. Format "H:A".
            const parsedL10JK = parseL10(match.l10);
            if (parsedL10JK.isValid) {
                const favPts = moFav === '1' ? parsedL10JK.homeWins : parsedL10JK.awayWins;
                // Assuming L10 is sum of points in last 5 games. < 5 pts = < 1.0 ppg
                if (favPts < 5) {
                    category = 'Standard'; // Demote from Banker
                    reasonParts.push("False Favorite (Poor Form)");
                }
            }
        }

        // [PROTOCOL: UPSET VIABILITY THRESHOLD]
        if (category === 'Upset') {
            // "Favorite is Top 5" -> Proxy: Odds < 1.50 or Group 1
            if (match.group === 1 || Math.min(o1, o2) < 1.50) {
                // Check if Fav lost 2+ consecutive away (Proxy: Away form very low)
                // If Away team is Fav (2) and L10(Away) is high, REJECT Upset
                if (moFav === '2') {
                    const l10A = parsedL10JK.isValid ? parsedL10JK.awayWins : 0;
                    if (l10A > 6) { // Decent form
                        // Reject Upset
                        category = 'Standard';
                        finalPrediction = '2'; // Or 'X2'
                        reasonParts.push("Upset Rejected (Strong Fav)");
                    }
                }
                // If Home team is Fav (1) and L10(Home) is high
                if (moFav === '1') {
                    const l10H = parsedL10JK.isValid ? parsedL10JK.homeWins : 0;
                    if (l10H > 6) {
                        category = 'Standard';
                        finalPrediction = '1';
                        reasonParts.push("Upset Rejected (Strong Fav)");
                    }
                }
            }
        }

        // [PROTOCOL: AWAY FAVORITE INSULATION]
        if (category === 'Value' && finalPrediction === '2') {
            // "Home Team Home Loss % < 40%"
            // Proxy: Home L10 > 4 (Not losing every game) OR Home Odds < 3.50 (Not terrible)
            if (o1 < 3.50) {
                // Mandatory Hedge '12' or 'X2'
                // If draw risk high -> X2, else 12
                if (pX > 0.28) finalPrediction = 'X2';
                else finalPrediction = '12';
                reasonParts.push("Away Fav Insulation");
            }
        }

        // [PROTOCOL: BANKER DRAW IDENTIFICATION (STALEMATE) - MERGED]
        // "Bankers draws shouldnt go unpredicted ever again."
        const isTightOdds = Math.abs(o1 - o2) < 0.2;
        const isHighDrawZone = (!isNaN(o1) && !isNaN(o2) && o1 >= 2.50 && o1 <= 2.90 && o2 >= 2.50 && o2 <= 2.90);
        
        if (match.group === 3 || isTightOdds || isHighDrawZone) {
             // High draw probability check (Lowered to 28% for High Draw Zone)
             const threshold = isHighDrawZone ? 0.28 : 0.33;
             
             if (pX > threshold || (sSubStatsProb && sSubStatsProb['X'] > threshold)) {
                 if (finalPrediction !== 'X') {
                     finalPrediction = p1 >= p2 ? '1X' : 'X2';
                     category = 'Banker'; // Banker Draw
                     reasonParts.push("Stalemate ID (Banker Draw)");
                 }
             }
        }

        // [PROTOCOL: CONTRARIAN ALGO vs. MARKET OVERRIDE (SIGNAL WEIGHTING)]
        // Diagnosis: Algo trying to be too clever against decisive favorites causes losses.
        // Rule: IF Market_Confidence_Home > 60% (Odds < 1.65) AND Algo != Fav AND Category != Upset -> Force Align.
        if (moFav && category !== 'Upset' && !isUnshakable) {
             const minO = Math.min(o1, o2);
             if (!isNaN(minO) && minO < 1.65) {
                 const algoOpposes = !matchesPrediction(finalPrediction, moFav);
                 if (algoOpposes) {
                     // Align with Market Favorite. Use Hedge for safety.
                     finalPrediction = moFav === '1' ? '1X' : 'X2';
                     reasonParts.push("Contrarian Override (Safe)");
                 }
             }
        }

        // [PROTOCOL: VALUE BET STABILIZATION]
        // Diagnosis: Value Bets chasing > 3.0 odds fail. Target mispriced favs.
        // Rule: If Category 'Value', Cap Odds at 2.80. If > 2.80, require Double Chance.
        if (category === 'Value') {
             const odds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
             if (!isNaN(odds) && odds > 2.80 && finalPrediction.length === 1) {
                 finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                 reasonParts.push("Value Stabilization (>2.80)");
             }
        }

        // [PROTOCOL: VALUE TRAP PROTOCOL (Ried/Hartberg Fix)]
        // IF Algo_Win_Prob > 55% AND Market_Odds > 2.35 THEN Downgrade Prediction from '1' to '1X'
        if (maxP > 0.55 && finalPrediction.length === 1) {
            const pOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
            if (!isNaN(pOdds) && pOdds > 2.35) {
                if (finalPrediction === '1') finalPrediction = '1X';
                else if (finalPrediction === '2') finalPrediction = 'X2';
                reasonParts.push("Value Trap (Odds > 2.35)");
            }
        }

        // [PROTOCOL: MARKET MOMENTUM RESPECT (Derby/Bradford Fix)]
        // IF Market_Home_Odds < 2.20 AND Algo_Favors_Away THEN Prediction must be '1X' or '12'. NEVER 'X2'.
        if (!isNaN(o1) && o1 < 2.20) {
            // Algo favors Away if prediction is 2 or X2
            if (finalPrediction === '2' || finalPrediction === 'X2') {
                finalPrediction = '1X'; // Safe pivot
                reasonParts.push("Market Momentum Respect");
            }
        }

        // [PROTOCOL: AWAY FAVORITE SKEPTICISM (Concarneau Rule)]
        // IF League Tier > 1 (Lower League List) AND Away Team is Favorite (Odds 2.00 - 2.40): MANDATORY Hedge (X2).
        if (isLowerLeague && finalPrediction === '2' && !isNaN(o2) && o2 >= 2.00 && o2 <= 2.40) {
            finalPrediction = 'X2';
            reasonParts.push("Concarneau Rule (Away Fav Hedge)");
        }



        // [PROTOCOL: UPSET IDENTIFICATION REFINEMENT]
        // IF Favorite_Odds < 1.70 BUT Algo_Form_Rating (Prob) < 40% THEN Trigger 'Upset Alert' (Play X2 or 12).
        if (!isNaN(o1) && !isNaN(o2)) {
            const mFav = o1 < o2 ? '1' : '2';
            const mFavOdds = mFav === '1' ? o1 : o2;
            const algoFavProb = mFav === '1' ? p1 : p2;
            
            if (mFavOdds < 1.70 && algoFavProb < 0.40) {
                // Trigger Upset
                category = 'Upset';
                finalPrediction = mFav === '1' ? 'X2' : '1X';
                reasonParts.push("Weak Fav Upset");
            }
        }

        // [PROTOCOL: THE '12' SIGNAL OVERRIDE]
        // IF Signal is '12' AND Under_2.5_Goals_Prob > 55% THEN Change Prediction to '1X' or 'X2'.
        // Proxy for Under 2.5: Total Exp Goals < 2.5
        if (finalPrediction === '12') {
            const totalExpGoals = (match.gsHome || 0) + (match.gsAway || 0); 
            if (totalExpGoals < 2.5) {
                // Low goals correlate with Draws, '12' is risky.
                // Pivot based on probabilities
                finalPrediction = p1 >= p2 ? '1X' : 'X2';
                reasonParts.push("'12' Override (Low Goals)");
            }
        }

        // [PROTOCOL: VALUE PICK 'HOLY GRAIL' FILTER (False Favorite Trap) - WITH RECALIBRATION]
        // IF Algo Win Prob > 55% BUT Market Odds > 2.65: DOWNGRADE
        // RECALIBRATION EXCEPTION: If Odds 2.65-2.90 AND Conf > 65% -> DISABLE HEDGE
        if (maxP > 0.55) {
            const predOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
            
            // EXCEPTION: RECALIBRATION
            const isRecalibrationException = !isNaN(predOdds) && predOdds >= 2.65 && predOdds <= 2.90 && rawConfidence > 65;

            if (!isRecalibrationException && !isNaN(predOdds) && predOdds > 2.65 && finalPrediction.length === 1) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                if (category === 'Value') category = 'Standard';
                reasonParts.push("False Favorite Trap");
            } else if (isRecalibrationException) {
                reasonParts.push("Value Trap Override (High Conf)");
                category = 'Value'; // Confirm Value Status
            }
        }

        // [PROTOCOL: BANKER HOME FIELD BIAS]
        if (category === 'Banker') {
            if (finalPrediction === '2') {
                // Must be dominant
                const isDominant = (match.tsb || 0) > (match.tsa || 0) + 1.0;
                if (!isDominant) {
                    // Downgrade
                    category = 'Standard';
                    reasonParts.push("Away Banker Bias Fail");
                }
            }
        }

        // [PROTOCOL: SELF LEARNING - PHA DRAW METRIC PRIMARY HEDGE]
        if (sSubStatsProb && sSubStatsProb['X'] > 0.30) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            // If 12, and draw risk is high, 12 might be risky if X is dominant, but 12 covers 2/3.
            // Usually "Cover Draw" implies including X.
            if (finalPrediction === '12') {
                // Jackpot fallback: check probabilities
                finalPrediction = p1 >= p2 ? '1X' : 'X2';
            }
            reasonParts.push("PHA Draw Hedge (>30%)");
        }

        // [PROTOCOL: SELF LEARNING - POTENTIAL DRAW FLAG]
        if (hasFlag('POTENTIAL_DRAW')) {
            if (finalPrediction.length === 1) {
                if (finalPrediction === '1') finalPrediction = '1X';
                else if (finalPrediction === '2') finalPrediction = 'X2';
            }
            if (finalPrediction === '12') {
                finalPrediction = p1 >= p2 ? '1X' : 'X2';
            }
            reasonParts.push("Potential Draw Volatility");
        }

        // [PROTOCOL: SELF LEARNING - HEDGE OPTIMIZATION]
        const predOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
        
        // [PROTOCOL: SELF LEARNING - HIGH ODDS VOLATILITY]
        const jpPredOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
        if (!isNaN(jpPredOdds) && jpPredOdds > 2.00 && finalPrediction.length === 1) {
            finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            reasonParts.push("High Odds Volatility");
        }

        // [PROTOCOL: SELF LEARNING - GROUP 2 STRUCTURAL DEFENSE]
        if (match.group === 2 && rawConfidence < 65 && finalPrediction.length === 1) {
            finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            reasonParts.push("Group 2 Defense");
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

            // 6. Balanced Split Avoidance (For Jackpot: Low Confidence)
            // All > 28% and < 40% (Roughly 33/33/33)
            if (p1_pha_b7 > 0.28 && p1_pha_b7 < 0.40 &&
                pX_pha_b7 > 0.28 && pX_pha_b7 < 0.40 &&
                p2_pha_b7 > 0.28 && p2_pha_b7 < 0.40) {
                
                rawConfidence = Math.min(rawConfidence, 30); // Very Low Confidence
                category = 'Standard';
                reasonParts.push("PHA Balanced Split (Low Conf)");
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
                rawConfidence = Math.max(rawConfidence, 85); // Elevate
                reasonParts.push("PHA+Sub Synergy");
            }
        }

        // 7. MO Conflict Risk Mitigation
        if (moFav && sSubStatsProb) {
            let phaPredDirection = null;
            if (sSubStatsProb['1'] > sSubStatsProb['2'] && sSubStatsProb['1'] > sSubStatsProb['X']) phaPredDirection = '1';
            else if (sSubStatsProb['2'] > sSubStatsProb['1'] && sSubStatsProb['2'] > sSubStatsProb['X']) phaPredDirection = '2';
            
            if (phaPredDirection && phaPredDirection !== moFav && rawConfidence <= 80) {
                reasonParts.push("PHA/MO Conflict Risk");
                // Force hedge
                if (finalPrediction.length === 1 && !isUnshakable) {
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
            rawConfidence = Math.min(rawConfidence, 40); 
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

    // [PROTOCOL: TS TIGHTNESS DRAW REMOVAL]
    const phaDrawPct = sSub ? Math.round((sSub['X']) * 100) : 0;
    
    // 2. TS Tightness Home Bias
    if (runTSLogic && tsDiff < 0.3 && phaDrawPct < 30) {
        if (finalPrediction === 'X') finalPrediction = '1';
    }

    // [PROTOCOL: GROUP 1 VOLATILITY PROTOCOL (The Brighton Rule)]
    if (match.group === 1 && !isNaN(o1) && o1 > 2.00 && match.patternAnalysis?.subPatternPrediction === '12') {
        if (finalPrediction === '1X') finalPrediction = '12';
    }

    // [PROTOCOL: DRAW PERSISTENCE IN CONFLICT ZONES (NEW)]
    if (match.patternAnalysis?.subPatternPrediction === '12' && match.group === 1) {
         // For Jackpot, default to 1X if no TS
         finalPrediction = '1X';
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

    // [PROTOCOL: THE 90% CERTAINTY THRESHOLD]
    if (sSubStatsProb && Math.max(p1_pha, pX_pha, p2_pha) >= 0.90) {
        if (p1_pha >= 0.90) finalPrediction = '1';
        else if (p2_pha >= 0.90) finalPrediction = '2';
        else finalPrediction = 'X';
        rawConfidence = 99;
        isUnshakable = true;
        reasonParts.push("PHA > 90%");
    }

    // [PROTOCOL: HOME/AWAY SPLIT '12' VALIDATION]
    if (sSubStatsProb && pX_pha <= 0.18 && p1_pha > 0.30 && p2_pha > 0.30) {
        finalPrediction = '12';
    }

    // [PROTOCOL: THE 14% EXCLUSION RULE (Home/Draw Split)]
    if (sSubStatsProb) {
        if (p2_pha < 0.15 && p1_pha > 0.30 && pX_pha > 0.30) finalPrediction = '1X';
        if (p1_pha < 0.15 && p2_pha > 0.30 && pX_pha > 0.30) finalPrediction = 'X2';
    }

    // [PROTOCOL: SUBPATTERN '12' ANTI-DRAW]
    const subPred = match.patternAnalysis?.subPatternPrediction;
    if (subPred === '12') {
        finalPrediction = '12';
    }

    // [PROTOCOL: GOLDEN VALIDATOR (PHA == SubPattern)]
    if (phaPred && subPred && phaPred === subPred) {
        rawConfidence = Math.max(rawConfidence, 85);
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

    // [PROTOCOL 71: PHA SUPREMACY]
    if (subPred && finalPrediction !== subPred) {
        if (sSubStatsProb) {
             const pMax = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
             if (pMax > 0.60) {
                 finalPrediction = subPred;
                 rawConfidence = Math.max(rawConfidence, 85);
                 reasonParts.push("PHA Supremacy");
                 isUnshakable = true;
             }
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
        
        // 2. Dual Confirmation Strategy
        const ptsPred = match.calculatedPrediction;
        if (matchesPrediction(algoSubPred, underdogOutcome) && ptsPred && matchesPrediction(ptsPred, underdogOutcome)) {
            finalPrediction = underdogOutcome;
            rawConfidence = Math.max(rawConfidence, 80);
            category = 'Upset';
            reasonParts.push("Dual Upset Conf (Algo+Pts)");
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

    // [PROTOCOL: DRAW OPPORTUNITY FINDER]
    // Removed conflicting '12' flip for tight odds to respect Banker Draw logic.
    
    if (phaDrawPct > 30 && (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) >= 0.2)) {
        if (rawConfidence < 70 && finalPrediction !== 'X') {
            finalPrediction = 'X';
            reasonParts.push("Draw Opportunity (High PHA)");
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

        // [PROTOCOL: JACKPOT HEDGE EXECUTION]
        if (minMarketOddsValue >= 2.0 && pX_pha_b2 > 0.30) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            else if (finalPrediction === '12') {
                finalPrediction = runTSLogic && (match.tsa || 0) > (match.tsb || 0) ? '1X' : 'X2';
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

    // [PROTOCOL 65] YOUTH VARIANCE (New)
    const isYouthLeague = /\b(U21|U23|Res|Reserve|Youth)\b/i.test(match.teams);
    if (isYouthLeague) {
         if (moFav && subPred && !matchesPrediction(subPred, moFav)) {
             rawConfidence = Math.min(rawConfidence, 40); 
             reasonParts.push("Youth Variance");
         }
         if (finalPrediction === '1X' || finalPrediction === 'X2') {
             finalPrediction = '12';
         }
         category = 'Standard';
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
        if (match.patternAnalysis?.subPatternPrediction === '1X') { // Fixed subPatternPattern to subPatternPrediction
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

    const parsedJkForm = parseL10(match.l10);
    if (parsedJkForm.isValid) {
        const l10H = parsedJkForm.homeWins;
        const l10A = parsedJkForm.awayWins;
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
            // [PROTOCOL: BANKER ACCURACY STABILIZATION]
            // IF Match_Is_Banker THEN Market_Odds MUST be < 1.85 AND Algo_Win_Prob > 65%. 
            // IF Odds > 1.85, reclassify as 'Value Pick' or Hedge.
            const bMinOdds = Math.min(o1, o2);
            if (!isNaN(bMinOdds)) {
                if (bMinOdds < 1.35) {
                    qualifiesAsBanker = false;
                    reasonParts.push("Odds Floor Violation (<1.35)");
                } else if (bMinOdds >= 1.85) {
                    // Strict Banker Cap
                    qualifiesAsBanker = false;
                    if (rawConfidence >= 65) category = 'Value'; // Move to Value
                    reasonParts.push("Banker Cap (>1.85)");
                } else if (maxP <= 0.65) {
                    qualifiesAsBanker = false;
                    reasonParts.push("Banker Conf Fail (<65%)");
                }
            }

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
            
            if (qualifiesAsBanker) category = 'Banker';
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

    // [PROTOCOL: HOLY GRAIL PROTOCOL (Value Picks)]
    // FOR 'Value Picks' (Unhedged): Sort by Algo_Confidence, NOT Edge.
    // IF Algo_Confidence < 50%, Match CANNOT be a single Value Pick; it must be hedged.
    if (category === 'Value' && finalPrediction.length === 1) {
        if (rawConfidence < 50) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            category = 'Standard'; // Downgrade or keep Value but hedged (which is Value Bet, not Value Pick)
            reasonParts.push("Holy Grail Hedge (Conf < 50%)");
        }
    }

    // --- START NEW JACKPOT STRATEGY ROOM ADJUSTMENTS (USER REQUEST) ---

    // [PROTOCOL: VALUE PICK PROBABILITY FLOOR]
    if ((category === 'Value' || category === 'Banker') && finalPrediction.length === 1) {
        // Check probability of the single outcome
        const singleProb = finalPrediction === '1' ? p1 : finalPrediction === '2' ? p2 : pX;
        if (singleProb < 0.51) {
            // "Opponent Loss Streak" proxy -> if we can't verify opponent is weak, assume risk.
            // Force Hedge
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            else if (finalPrediction === 'X') finalPrediction = '1X'; // Safe default for X
            category = 'Standard'; // Downgrade from Value Pick/Banker if hedged (usually Value Picks are singles)
            reasonParts.push("Value Prob Floor (<51%)");
        }
    }

    // [PROTOCOL: THE FALSE STALEMATE CORRECTION]
    if (finalPrediction === 'X' && pX > 0.40) {
        // Away Counter-Attack Rating High Proxy: Away GS > 1.2
        if ((match.gsAway || 0) > 1.2) {
            finalPrediction = 'X2';
            reasonParts.push("False Stalemate (Away Counter)");
        }
    }

    // [PROTOCOL: UPSET VALIDATION PROTOCOL]
    if (category === 'Upset' && moFav) {
        // Market Favorite Form > 60% (Last 5 Games)
        // Proxy using L10 (Points in last 5 games). Max 15. 60% is 9.
        const parsedUpsetL10 = parseL10(match.l10);
        if (parsedUpsetL10.isValid) {
            const favPts = moFav === '1' ? parsedUpsetL10.homeWins : parsedUpsetL10.awayWins;
            if (favPts >= 9) {
                // Override Upset
                finalPrediction = moFav === '1' ? '1X' : 'X2';
                category = 'Standard';
                reasonParts.push("Upset Invalidated (Fav Form > 60%)");
            }
        }
    }

    // [PROTOCOL: BANKER ISOLATION STRATEGY]
    // IF Home Win Prob > 60% AND Away xG < 0.8, THEN Classify as BANKER
    // ELSE Downgrade Home Bankers to Value Bet
    if (finalPrediction === '1') {
        if (p1 > 0.60 && (match.gsAway || 0) < 0.8) {
            if (category !== 'Banker') {
                category = 'Banker';
                reasonParts.push("Banker Isolation (Dominance)");
            }
        } else if (category === 'Banker') {
            category = 'Value';
            reasonParts.push("Banker Isolation Fail");
        }
    }

    // [PROTOCOL: HOME FAVORITE RESILIENCE CHECK]
    if (finalPrediction === '1' && (category === 'Value' || category === 'Banker')) {
        // Away Team Draw % > 35% (Use PHA X or pX)
        const drawRisk = sSubStatsProb ? sSubStatsProb['X'] : pX;
        if (drawRisk > 0.35) {
            finalPrediction = '1X';
            reasonParts.push("Home Fav Resilience Hedge");
        }
    }

    // [PROTOCOL: VALUE BET HEDGING WIDTH]
    // IF Favorite Odds > 2.20 ... THEN Hedge must be 12 or predict underdog and hedge.
    if (moFav) {
        const favOdds = moFav === '1' ? o1 : o2;
        if (!isNaN(favOdds) && favOdds > 2.20) {
            // Check if we are currently backing the favorite
            if (matchesPrediction(finalPrediction, moFav)) {
                // Switch to 12 (Open Game) to cover upset
                finalPrediction = '12';
                reasonParts.push("Tight Fav Hedge (12)");
            }
        }
    }

    // [PROTOCOL: DRAW FREQUENCY CALIBRATION]
    const totalExpGoals = (match.gsHome || 0) + (match.gsAway || 0);
    // "Both Teams Scored in < 40% of last 5" -> Proxy: Low Total Goals + Low GA for both
    if (totalExpGoals < 2.0 && (match.gaHome || 0) < 1.0 && (match.gaAway || 0) < 1.0) {
        if (finalPrediction !== 'X') {
            finalPrediction = 'X';
            category = 'Banker';
            reasonParts.push("Boring Draw Calibration");
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
                if (match.isJackpot) { // MinOddsValue check removed for Jackpot as it's always relevant
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
        }
    }

    if (match.group === 3 && sSub && sSub['X'] > 0.50) {
        if (finalPrediction === 'X') {
            finalPrediction = runTSLogic && (match.tsa || 0) >= (match.tsb || 0) ? '1X' : 'X2';
        }
    }

    if (rawConfidence >= 72) isUnshakable = true;

    // --- NEW STRICT JACKPOT PROTOCOLS (USER UPDATES) ---

    // [PROTOCOL: PREFERENCE WEIGHTING & BANKER QUALIFICATION]
    // "Especially when more than half the preferences support a certain outcome."
    let supportCount = 0;
    
    // 1. Market Favorite
    if (moFav && matchesPrediction(finalPrediction, moFav)) supportCount++;
    // 2. PHA Support
    if (sSubStatsProb) {
        const maxPha = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
        let phaDir = sSubStatsProb['1'] === maxPha ? '1' : sSubStatsProb['X'] === maxPha ? 'X' : '2';
        if (matchesPrediction(finalPrediction, phaDir)) supportCount++;
    }
    // 3. External Support
    if (match.pred1x2 && matchesPrediction(finalPrediction, match.pred1x2)) supportCount++;
    // 4. Sub Pattern Support
    if (rulePrediction && matchesPrediction(finalPrediction, rulePrediction)) supportCount++;
    // 5. Probability Support
    let probDir = 'X';
    if (p1 > pX && p1 > p2) probDir = '1';
    else if (p2 > p1 && p2 > pX) probDir = '2';
    if (matchesPrediction(finalPrediction, probDir)) supportCount++;
    // 6. Points System Support
    if (match.calculatedPrediction && matchesPrediction(finalPrediction, match.calculatedPrediction)) supportCount++;
    
    // Algo Support is implied if we are here with this prediction.
    
    if (supportCount >= 4) { // More than half of relevant external signals
        if (rawConfidence < 85) rawConfidence = 85;
        if (category === 'Standard') category = 'Banker';
        reasonParts.push(`Strong Preference Support (${supportCount}/6)`);
    }

    // [PROTOCOL: ALGO AUDIT - CONTRADICTION CHECK]
    // If Algo contradicts Market Fav, PHA, and External -> Likely Wrong.
    if (!isUnshakable) {
        let contradictions = 0;
        if (moFav && !matchesPrediction(finalPrediction, moFav)) contradictions++;
        
        if (sSubStatsProb) {
             let phaDir = sSubStatsProb['1'] > sSubStatsProb['2'] ? '1' : '2'; // Simplified direction
             if (!matchesPrediction(finalPrediction, phaDir)) contradictions++;
        }
        
        if (match.pred1x2 && !matchesPrediction(finalPrediction, match.pred1x2)) contradictions++;
        
        if (contradictions === 3) {
            // Audit: Only support is SubPattern + Points?
            // Revert to Market/PHA consensus
            if (moFav) {
                finalPrediction = moFav === '1' ? '1X' : 'X2';
                reasonParts.push("Algo Contradiction Audit (Revert)");
                category = 'Standard';
                rawConfidence = 50;
            }
        }
    }

    // [PROTOCOL: PHA SUB-PATTERN VALIDATION]
    // If sub pattern is 1X but PHA is Home/Away split -> Predict 12
    if (match.patternAnalysis?.subPatternPrediction === '1X' && sSubStatsProb) {
        // Check if Away > Draw significantly
        if (sSubStatsProb['2'] > sSubStatsProb['X'] && sSubStatsProb['2'] > 0.35) {
             // Home is likely high too if 1X was suggested.
             // Implies Split.
             finalPrediction = '12';
             reasonParts.push("PHA Split (SubPat 1X Invalid)");
        }
    }

    // [PROTOCOL: DRAW RISK HEDGING]
    // Any match with Draw Prob > 30% OR PHA Draw > 30% has draw risk.
    if (!isUnshakable) { // Don't touch Super Bankers
        if (pX > 0.30 || (sSubStatsProb && sSubStatsProb['X'] > 0.30)) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            else if (finalPrediction === '12') {
                // If draw risk is high, 12 is bad.
                finalPrediction = p1 >= p2 ? '1X' : 'X2';
            }
            reasonParts.push("Draw Risk Hedge (>30%)");
        }
    }

    // [PROTOCOL: NO STRAIGHT DRAWS]
    // All draw prediction must be hedged.
    if (finalPrediction === 'X') {
        // Hedge towards probability lean
        finalPrediction = p1 >= p2 ? '1X' : 'X2';
        reasonParts.push("No Straight X Rule");
        // Ensure Banker Draws are hedged (Rule 5) - covered here.
    }

    // [PROTOCOL: UNDERDOG CAUTION]
    // Don't predict towards underdog unless convinced (Upset Category).
    if (moFav && !matchesPrediction(finalPrediction, moFav)) {
        // Current prediction supports Underdog
        if (category !== 'Upset' && !isUnshakable) {
            // We are not convinced. Revert to Hedge covering Favorite.
            finalPrediction = moFav === '1' ? '1X' : 'X2';
            reasonParts.push("Underdog Caution");
        }
    }

    // [PROTOCOL: ALGO '12' VOLATILITY HANDLING & UPSET LOGIC]
    if (match.patternAnalysis?.subPatternPrediction === '12' || finalPrediction === '12') {
        // "The AI should minimize 12 hedges, these kind of matches usually end up in a draw."
        // "If algo prediction is 12, the AI should flag this as potential upset"
        
        // Determine Underdog and Favorite
        const underdog = moFav === '1' ? '2' : '1';
        
        // Check Upset Qualification (simplified check here, mimics Match Selector Logic)
        // A match qualifies as Upset if Algo supports Underdog or PHA supports Underdog > 35% or Points supports Underdog
        let isUpsetQualified = false;
        
        // Check Probability Support for Underdog (p1 or p2)
        const underdogProb = underdog === '1' ? p1 : p2;
        
        // Check PHA Support
        let phaUnderdogSupport = 0;
        if (sSubStatsProb) {
            phaUnderdogSupport = sSubStatsProb[underdog as '1'|'2'];
        }
        
        if (underdogProb > 0.35 || phaUnderdogSupport > 0.35) {
            isUpsetQualified = true;
        }
        
        // Points Support
        if (match.calculatedPrediction && matchesPrediction(match.calculatedPrediction, underdog)) {
            isUpsetQualified = true;
        }

        if (isUpsetQualified) {
             // "predict the underdog straight win"
             finalPrediction = underdog; 
             category = 'Upset';
             reasonParts.push("'12' Volatility -> Upset Win");
        } else {
             // "predict the underdog and hedge" (1X if Home is Dog, X2 if Away is Dog)
             // If Home (1) is Underdog -> Hedge is 1X
             // If Away (2) is Underdog -> Hedge is X2
             finalPrediction = moFav === '1' ? 'X2' : '1X';
             reasonParts.push("'12' Volatility -> Underdog Hedge");
        }
    }

    // [PROTOCOL: CONFLICT RESOLUTION (ALGO vs MARKET FAV)]
    if (moFav && !matchesPrediction(finalPrediction, moFav)) {
        // Algo contradicts Market Favorite
        if (sSubStatsProb) {
             const p1_pha = sSubStatsProb['1'];
             const p2_pha = sSubStatsProb['2'];
             const phaDir = p1_pha > p2_pha ? '1' : '2'; // Simplification ignoring X for conflict check
             
             if (matchesPrediction(phaDir, finalPrediction)) {
                 // PHA Supports Algo
                 // "must have support of atleast two other prefernces"
                 let sCount = 0;
                 // 1. External Support
                 if (match.pred1x2 && matchesPrediction(match.pred1x2, finalPrediction)) sCount++;
                 // 2. Points Support
                 if (match.calculatedPrediction && matchesPrediction(match.calculatedPrediction, finalPrediction)) sCount++;
                 // 3. Probability Support (Already implicit in finalPrediction, but check dominance)
                 if (Math.max(p1, pX, p2) > 0.45) sCount++;

                 if (sCount < 2) {
                     // Fallback: Go with Market Favorite
                     finalPrediction = moFav === '1' ? '1X' : 'X2'; // Revert to Market Fav
                     reasonParts.push("Algo/PHA Conflict (Low Support) -> Market Fav");
                 } else {
                     reasonParts.push("Algo/PHA Override (Supported)");
                 }
             } else if (matchesPrediction(phaDir, moFav)) {
                 // PHA Supports Market Favorite
                 // "go with the market favorite"
                 finalPrediction = moFav === '1' ? '1X' : 'X2';
                 reasonParts.push("PHA Supports Market Fav");
             }
        }
    }

    // [PROTOCOL: PHA CONFLICT & VOLATILITY (UPSET POTENTIAL)]
    if (moFav && sSubStatsProb) {
        const p1_pha = sSubStatsProb['1'];
        const p2_pha = sSubStatsProb['2'];
        const phaUnderdogProb = moFav === '1' ? p2_pha : p1_pha;
        const phaFavProb = moFav === '1' ? p1_pha : p2_pha;
        
        // "PHA supports the underdog or PHA for market favorite is almost the same as the underdog"
        if (phaUnderdogProb > phaFavProb || Math.abs(phaFavProb - phaUnderdogProb) < 0.10) {
            // Volatility detected. Check Upset Potential.
            const subPatternIs12 = match.patternAnalysis?.subPatternPrediction === '12';
            
            // If SubPattern is 12, we likely already handled it above, but double check
            // or apply general Upset Logic if not handled
            if (subPatternIs12 || finalPrediction === '12') {
                // Logic already covered in '12' block, but reinforce category
                if (category !== 'Upset' && finalPrediction.length === 1) category = 'Upset';
            } else {
                // Consider Upset if not already predicted
                if (matchesPrediction(finalPrediction, moFav)) {
                    // Swing to Hedge at least
                    finalPrediction = moFav === '1' ? '1X' : 'X2';
                    reasonParts.push("PHA Volatility Hedge");
                }
            }
        }
    }

    // [PROTOCOL: VALUE BETS NO '12']
    if (category === 'Value') {
        if (finalPrediction === '12') {
            const underdog = moFav === '1' ? '2' : '1';
            finalPrediction = underdog === '1' ? '1X' : 'X2';
            reasonParts.push("Value Bet No-12 Rule");
        }
    }

    // [PROTOCOL: VALUE PICKS PREFERENCE CHECK]
    // Value picks Must be matches with odds between 2.0 to 2.5.
    if (category === 'Value') {
        const vOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
        if (!isNaN(vOdds) && (vOdds < 2.0 || vOdds > 2.5)) {
            category = 'Standard';
            if (finalPrediction.length === 1) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            }
            reasonParts.push("Value Pick Rejected (Odds not 2.0-2.5)");
        }
    }

    // [PROTOCOL: BANKER DRAWS PREFERENCE CHECK]
    // Banker draws must be matches where both home and away have odd >= 2.0.
    if (category === 'Banker' && finalPrediction === 'X') {
        if (!isNaN(o1) && !isNaN(o2) && (o1 < 2.0 || o2 < 2.0)) {
            category = 'Standard';
            reasonParts.push("Banker Draw Rejected (Odds < 2.0)");
        }
    }

    // [PROTOCOL: GROUP 3 AUTHORITY OVERRIDE]
    if (match.group === 3) {
        // Weight Algo Primary Pick at 90%, Ignore External if contradictory
        if (match.pred1x2 && !matchesPrediction(finalPrediction, match.pred1x2)) {
            // Ignore external conflict downgrade
            rawConfidence = Math.max(rawConfidence, 90);
            reasonParts.push("Group 3 Authority");
        }
    }

    // [PROTOCOL: CONSENSUS TRIANGULATION (HOLY GRAIL)]
    // IF AI Prediction == External Sentiment == PHA Algo
    const ext = match.pred1x2;
    let phaAlgo = null;
    if (sSubStatsProb) {
         const maxS = Math.max(sSubStatsProb['1'], sSubStatsProb['X'], sSubStatsProb['2']);
         if (maxS === sSubStatsProb['1']) phaAlgo = '1';
         else if (maxS === sSubStatsProb['X']) phaAlgo = 'X';
         else phaAlgo = '2';
    }
    
    if (ext && phaAlgo && finalPrediction === ext && finalPrediction === phaAlgo) {
        // Lock as Single Outcome (Value Pick)
        if (finalPrediction.length === 1) { // Ensure it's a single outcome
            category = 'Value'; // Treat as Value Pick
            isUnshakable = true;
            reasonParts.push("Holy Grail Consensus");
        }
    }

    // [PROTOCOL: BANKER VOLATILITY FILTER]
    if (category === 'Banker') {
        const oppGoals = finalPrediction.includes('1') ? (match.gsAway || 0) : (match.gsHome || 0); // Approx logic
        
        // H2H Balanced Check (Proxy via L10 or LE if available)
        let h2hBalanced = false;
        // Assuming LE string format might hint at it, but usually LE score like "A1:1"
        if (match.le && match.le.includes(':')) {
            // If drawish
            if (match.le.includes('1:1') || match.le.includes('0:0') || match.le.includes('2:2')) h2hBalanced = true;
        }

        if (maxP > 0.60 && (oppGoals > 1.5 || h2hBalanced)) {
            // Downgrade
            if (finalPrediction.length === 1) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            }
            category = 'Standard';
            reasonParts.push("Banker Volatility Filter");
        }
    }

    // [PROTOCOL: FALSE FAVORITE DETECTION]
    if (category === 'Banker' && !isNaN(Math.min(o1, o2)) && Math.min(o1, o2) < 2.50) {
        // Team Points Per Game (Last 5) < 1.0 check
        // Using L10 as proxy. Format "H:A".
        const parsedBankerL10 = parseL10(match.l10);
        if (parsedBankerL10.isValid) {
            const favPts = moFav === '1' ? parsedBankerL10.homeWins : parsedBankerL10.awayWins;
            // Assuming L10 is sum of points in last 5 games. < 5 pts = < 1.0 ppg
            if (favPts < 5) {
                category = 'Standard'; // Demote from Banker
                reasonParts.push("False Favorite (Poor Form)");
            }
        }
    }

    // [PROTOCOL: UPSET VIABILITY THRESHOLD]
    if (category === 'Upset') {
        // "Favorite is Top 5" -> Proxy: Odds < 1.50 or Group 1
        if (match.group === 1 || Math.min(o1, o2) < 1.50) {
            // Check if Fav lost 2+ consecutive away (Proxy: Away form very low)
            // If Away team is Fav (2) and L10(Away) is high, REJECT Upset
            if (moFav === '2') {
                const l10A = parsedBankerL10.isValid ? parsedBankerL10.awayWins : 0;
                if (l10A > 6) { // Decent form
                    // Reject Upset
                    category = 'Standard';
                    finalPrediction = '2'; // Or 'X2'
                    reasonParts.push("Upset Rejected (Strong Fav)");
                }
            }
            // If Home team is Fav (1) and L10(Home) is high
            if (moFav === '1') {
                const l10H = parsedBankerL10.isValid ? parsedBankerL10.homeWins : 0;
                if (l10H > 6) {
                    category = 'Standard';
                    finalPrediction = '1';
                    reasonParts.push("Upset Rejected (Strong Fav)");
                }
            }
        }
    }

    // [PROTOCOL: AWAY FAVORITE INSULATION]
    if (category === 'Value' && finalPrediction === '2') {
        // "Home Team Home Loss % < 40%"
        // Proxy: Home L10 > 4 (Not losing every game) OR Home Odds < 3.50 (Not terrible)
        if (o1 < 3.50) {
            // Mandatory Hedge '12' or 'X2'
            // If draw risk high -> X2, else 12
            if (pX > 0.28) finalPrediction = 'X2';
            else finalPrediction = '12';
            reasonParts.push("Away Fav Insulation");
        }
    }

    // [PROTOCOL: BANKER DRAW IDENTIFICATION (STALEMATE)]
    // "Bankers draws shouldnt go unpredicted ever again."
    if (match.group === 3 || (Math.abs(o1 - o2) < 0.2 && o1 > 2.50)) {
         // High draw probability check
         if (pX > 0.33 || (sSubStatsProb && sSubStatsProb['X'] > 0.33)) {
             if (finalPrediction !== 'X') {
                 finalPrediction = 'X';
                 category = 'Banker'; // Banker Draw
                 reasonParts.push("Stalemate ID (Banker Draw)");
             }
         }
    }
    
    // [PROTOCOL: JACKPOT STRATEGY ADJUSTMENTS - BATCH 2026-02-19]

    const minOddsFinal = Math.min(o1, o2);

    // [PROTOCOL: JACKPOT HOME UNDERDOG BIAS]
    if (!isNaN(o1) && o1 >= 2.40 && o1 <= 2.60 && !isNaN(o2) && o2 > 2.80) {
        if (finalPrediction === '1' || finalPrediction === '2' || finalPrediction === 'X') {
             finalPrediction = '1X';
             reasonParts.push("Home Underdog Bias");
        }
    }

    // [PROTOCOL: JACKPOT UPSETS VOLATILITY ALLOWANCE]
    if (category === 'Upset' && !isNaN(o1) && o1 > 2.50 && !isNaN(o2) && o2 > 2.50) {
        if (pX > 0.32) {
            // Allow it - do not downgrade
            reasonParts.push("Volatility Allowance (Draw > 32%)");
        }
    }

    // [PROTOCOL: BANKER THRESHOLD ELEVATION]
    if (category === 'Banker') {
        const isPhaDisagree = sSubStatsProb && !matchesPrediction(finalPrediction, (sSubStatsProb['1'] > sSubStatsProb['2'] ? '1' : '2')); // Simplified check
        if (maxP < 0.65 || isPhaDisagree) {
            category = 'Value';
            // Apply Double Chance
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            reasonParts.push("Banker Downgrade (Elevated Threshold)");
        }
    }

    // [PROTOCOL: VALUE PICK (HOLY GRAIL) CONVERSION]
    if (category === 'Value' && finalPrediction.length === 1) {
        // "Probability must be > 60% AND Sub-Pattern must indicate 'Form Dominance' (Won 3/5 last matches)"
        // Proxy for Form Dominance: PHA Win Rate > 60%
        const phaWinRate = algo.getPatternWinRate(subP, finalPrediction);
        if (maxP <= 0.60 || phaWinRate <= 60) {
            // Force Hedge
            finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            reasonParts.push("Value Hedge (Holy Grail Fail)");
        }
    }

    // [PROTOCOL: HOME FORTRESS CORRECTION (UPSET LOGIC)]
    // "IF Step 2 Upset suggests Away Win/Draw (X2) BUT Home Team has lost < 20% of last 10 Home Games"
    if (finalPrediction === 'X2') {
        const parsedFortress = parseL10(match.l10);
        const l10Home = parsedFortress.isValid ? parsedFortress.homeWins : 0;
        // L10 Home usually points. If they lost < 20%, they won/drew > 80%.
        // Assuming L10 score > 7 means strong home form.
        if (l10Home > 7) {
            finalPrediction = '1X'; // Revert to Home bias
            category = 'Standard';
            reasonParts.push("Home Fortress Correction");
        }
    }

    // [PROTOCOL: BANKER DRAW IDENTIFICATION STRATEGY]
    const totalExpGoalsBD = (match.gsHome || 0) + (match.gsAway || 0);
    const tsDiffVal = Math.abs((match.tsa || 0) - (match.tsb || 0));
    if (totalExpGoalsBD < 2.25 && tsDiffVal < 0.10) { // < 10% diff
        category = 'Banker'; // Banker Draw Candidate
        // Hedge 1X if Home Odds < 2.60, else Hedge X2
        if (!isNaN(o1) && o1 < 2.60) finalPrediction = '1X';
        else finalPrediction = 'X2';
        reasonParts.push("Banker Draw Hedge Strategy");
    }

    // [PROTOCOL: PHA ALIGNMENT OVERRIDE]
    // "IF AI Prediction conflicts with PHA Prediction AND AI Confidence score is < 58%"
    // AI Prediction here refers to `finalPrediction` derived so far.
    if (phaPrediction && !matchesPrediction(finalPrediction, phaPrediction) && rawConfidence < 58) {
        finalPrediction = phaPrediction;
        reasonParts.push("PHA Alignment Override (<58% Conf)");
    }

    // [PROTOCOL: VALUE BET SAFETY NET]
    if (category === 'Value' && !isNaN(minOddsFinal) && minOddsFinal > 2.80) {
        if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            reasonParts.push("Value Safety Net (>2.80)");
        }
    }

    // [PROTOCOL: UNDERDOG BIAS ELIMINATION]
    // "IF Step 2 Upset is triggered... require secondary confirmation"
    // We don't have 'Fatigue' data. We can use 'Recent Form' (L10) as proxy.
    // If Upset (X2 or 1X against Fav), Fav must have poor form (L10 < 4).
    if (category === 'Upset') {
        const favTeam = moFav === '1' ? 'Home' : 'Away';
        const parsedUnderdogForm = parseL10(match.l10);
        const l10Fav = parsedUnderdogForm.isValid 
            ? (favTeam === 'Home' ? parsedUnderdogForm.homeWins : parsedUnderdogForm.awayWins)
            : 0;
        
        if (l10Fav > 6) { // Fav has good form
             // Invalidate Upset
             category = 'Standard';
             finalPrediction = moFav === '1' ? '1X' : 'X2';
             reasonParts.push("Upset Invalidated (Fav Form Good)");
        }
    }

    // [PROTOCOL: JACKPOT STRATEGY SUB-PATTERN IGNORE]
    // "Ignore Sub-Pattern signals if Market Odds for the Draw are below 3.10"
    if (!isNaN(oX) && oX < 3.10) {
        // If SubPattern was the primary reason for a specific outcome, dampen it?
        // We can't easily 'ignore' it retrospectively without re-running, but we can prioritize Market/Points.
        // If Final Prediction is purely SubPattern based and contradicts Market/Points, revert.
        if (rulePrediction && finalPrediction === rulePrediction) {
             if (moFav && !matchesPrediction(finalPrediction, moFav)) {
                 finalPrediction = moFav === '1' ? '1X' : 'X2';
                 reasonParts.push("SubPattern Ignored (Draw Odds < 3.10)");
             }
        }
    }

    // [PROTOCOL: JACKPOT STRATEGY ADJUSTMENTS - BATCH 2026-02-19 - PART 2]

    // [PROTOCOL: ALGO-CENTRIC WEIGHTING SHIFT]
    // "IF External 1x2 conflicts with PHA, DISCARD External signal entirely. FOLLOW PHA for the primary direction."
    if (match.pred1x2 && sSubStatsProb) {
        const p1s = sSubStatsProb['1'];
        const pXs = sSubStatsProb['X'];
        const p2s = sSubStatsProb['2'];
        const maxS = Math.max(p1s, pXs, p2s);
        let phaDir = '';
        if (maxS === p1s) phaDir = '1';
        else if (maxS === pXs) phaDir = 'X';
        else phaDir = '2';

        if (!matchesPrediction(phaDir, match.pred1x2)) {
            // Discard External, follow PHA
            if (!matchesPrediction(finalPrediction, phaDir)) {
                if (phaDir === '1') finalPrediction = '1X';
                else if (phaDir === '2') finalPrediction = 'X2';
                else finalPrediction = p1 > p2 ? '1X' : 'X2';
                reasonParts.push("Algo-Centric Shift (Follow PHA)");
            }
        }
    }

    // [PROTOCOL: HOLY GRAIL VALUE PICK LOCK]
    // "IF ALGO, PHA, and Market Sentiment do not UNANIMOUSLY AGREE on the outcome, REJECT as Value Pick."
    if (category === 'Value') {
        let unanimous = true;
        
        // 1. Algo Agreement (finalPrediction is Algo)
        
        // 2. PHA Agreement
        if (sSubStatsProb) {
            const p1s = sSubStatsProb['1'];
            const pXs = sSubStatsProb['X'];
            const p2s = sSubStatsProb['2'];
            const maxS = Math.max(p1s, pXs, p2s);
            let phaDir = '';
            if (maxS === p1s) phaDir = '1';
            else if (maxS === pXs) phaDir = 'X';
            else phaDir = '2';
            
            if (!matchesPrediction(finalPrediction, phaDir)) unanimous = false;
        } else {
            unanimous = false; // No PHA data = No Agreement
        }
        
        // 3. Market Sentiment Agreement (moFav)
        if (moFav && !matchesPrediction(finalPrediction, moFav)) unanimous = false;
        
        if (!unanimous) {
            category = 'Standard';
            reasonParts.push("Value Pick Rejected (Non-Unanimous)");
            // Hedge for safety if it was a single
            if (finalPrediction.length === 1) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            }
        }
    }

    // [PROTOCOL: BANKER DRAW IDENTIFICATION (THE HEDGE)]
    // "IF Match Odds for Favorite > 2.05 AND SubPattern Draw % > 30%, MANDATORY HEDGE (1X or X2). DO NOT PREDICT STRAIGHT WIN."
    const minOddsFav = Math.min(o1, o2);
    if (!isNaN(minOddsFav) && minOddsFav > 2.05) {
        if (sSubStatsProb && sSubStatsProb['X'] > 0.30) {
            if (finalPrediction === '1') finalPrediction = '1X';
            else if (finalPrediction === '2') finalPrediction = 'X2';
            reasonParts.push("Banker Draw Hedge (Fav>2.05, Draw>30%)");
        }
    }

    // [PROTOCOL: SUBPATTERN SAMPLE SIZE THRESHOLD]
    // "IF SubPattern Sample Size (N) < 6, IGNORE SubPattern percentage. Default to Algo and Form analysis."
    if (sSubStats && sSubStats.total < 6) {
        // If prediction relied heavily on PHA (e.g. PHA Override), revert?
        // Or just downgrade confidence.
        if (reasonParts.some(r => r.includes("PHA"))) {
            rawConfidence = Math.min(rawConfidence, 50);
            reasonParts.push("Low Sample Size (N<6)");
            // If it was a 'Value' or 'Banker' based on PHA, downgrade
            if (category !== 'Standard') {
                if (category === 'Value' && finalPrediction.length === 1) {
                    finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                }
                category = 'Standard';
            }
        }
    }

    // [PROTOCOL: VALUE BET STABILIZATION]
    // "IF Value Bet Odds > 2.40, REQUIRE PHA Agreement. IF PHA disagrees, remove from Value Bet category."
    if (category === 'Value') {
        const vOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
        if (!isNaN(vOdds) && vOdds > 2.40) {
            let phaAgrees = false;
            if (sSubStatsProb) {
                const p1s = sSubStatsProb['1'];
                const pXs = sSubStatsProb['X'];
                const p2s = sSubStatsProb['2'];
                const maxS = Math.max(p1s, pXs, p2s);
                let phaDir = '';
                if (maxS === p1s) phaDir = '1';
                else if (maxS === pXs) phaDir = 'X';
                else phaDir = '2';
                
                if (matchesPrediction(finalPrediction, phaDir)) phaAgrees = true;
            }
            
            if (!phaAgrees) {
                category = 'Standard';
                if (finalPrediction.length === 1) {
                    finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                }
                reasonParts.push("Value Bet Destabilized (>2.40 No PHA)");
            }
        }
    }

    // [PROTOCOL: VALUE BET STABILIZATION (HIGH ODDS)]
    // IF Value Bet Odds > 3.00, THEN Mandatory Double Chance (1X or X2). NO Straight Wins on odds > 3.00 unless Banker criteria are met
    if (category === 'Value' && finalPrediction.length === 1) {
        const vOdds = finalPrediction === '1' ? o1 : finalPrediction === '2' ? o2 : oX;
        if (!isNaN(vOdds) && vOdds > 3.00) {
            finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            reasonParts.push("High Odds Value Hedge (>3.00)");
        }
    }

    // [PROTOCOL: CAPITALIZING ON HIGH-YIELD PATTERNS]
    // Assign an automatic +5% confidence boost to specific sub-patterns.
    const highYieldPatterns = ['G2p10', 'G2q10', 'G2ee3', 'G3o7'];
    const highYieldMainPatterns = ['C', 'K', 'Y', 'L'];
    if (highYieldPatterns.includes(subP) || highYieldMainPatterns.includes(mainP)) {
        maxP = Math.min(0.99, maxP + 0.05);
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

    // [PROTOCOL: BANKER ACCURACY PROTOCOL (THE OMONIA FIX)]
    // Bankers and value picks should have PHA support >= 50%
    if (category === 'Banker' || category === 'Value') {
        let phaSupport = 0;
        if (sSubStatsProb) {
            if (finalPrediction.includes('1')) phaSupport = Math.max(phaSupport, sSubStatsProb['1']);
            if (finalPrediction.includes('2')) phaSupport = Math.max(phaSupport, sSubStatsProb['2']);
            if (finalPrediction.includes('X')) phaSupport = Math.max(phaSupport, sSubStatsProb['X']);
        }
        
        if (phaSupport < 0.50) {
            category = 'Standard';
            if (finalPrediction.length === 1) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            }
            reasonParts.push("Banker/Value Rejected (PHA < 50%)");
        }
    }

    // [PROTOCOL: STRAIGHT WIN CANDIDATE IDENTIFICATION]
    // "Matches with PHA support >= 50%, + Probality >= 50% + Algo support are good candindates for straight wins"
    if (sSubStatsProb && maxP >= 0.50) {
        const p1s = sSubStatsProb['1'];
        const p2s = sSubStatsProb['2'];
        const phaSupport = finalPrediction.includes('1') ? p1s : p2s; // Rough check
        
        if (phaSupport >= 0.50) {
            // If currently hedged, consider upgrading to Single?
            // Only if Algo (subPatternPrediction) also agrees
            if (match.patternAnalysis?.subPatternPrediction && matchesPrediction(match.patternAnalysis.subPatternPrediction, finalPrediction)) {
                if (finalPrediction === '1X') {
                     // Check if 1 is dominant
                     if (p1 >= pX) {
                         finalPrediction = '1';
                         reasonParts.push("Straight Win Upgrade (Strong Signals)");
                         if (category === 'Standard') category = 'Value'; // Potential Value
                     }
                } else if (finalPrediction === 'X2') {
                     if (p2 >= pX) {
                         finalPrediction = '2';
                         reasonParts.push("Straight Win Upgrade (Strong Signals)");
                         if (category === 'Standard') category = 'Value';
                     }
                }
            }
        }
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

    // [PROTOCOL: Banker Leak Fix]
    // IF Algo Prediction contradicts Sub Pattern Prediction THEN DO NOT classify as Banker.
    if (category === 'Banker') {
        if (rulePrediction && !matchesPrediction(rulePrediction, finalPrediction)) {
            category = 'Standard';
            reasonParts.push("Banker Leak Fix (SubPat Conflict)");
        }
    }

    // [PROTOCOL: Jackpot Value Pick Protocol]
    // IF Value Pick AND SubPat is 12 THEN DO NOT force a straight bet; either hedge or require PHA > 60% for the straight prediction.
    if (category === 'Value' && rulePrediction === '12') {
        if (finalPrediction.length === 1) {
            let phaSupport = 0;
            if (sSubStatsProb) {
                if (finalPrediction === '1') phaSupport = sSubStatsProb['1'];
                else if (finalPrediction === '2') phaSupport = sSubStatsProb['2'];
            }
            
            if (phaSupport <= 0.60) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                reasonParts.push("Value Pick 12 Protocol (Hedge)");
            } else {
                reasonParts.push("Value Pick 12 Protocol (PHA > 60%)");
            }
        }
    }

    // [PROTOCOL: Banker Draws Identification (Tight Odds)]
    // IF Draw Odds < 3.25 AND SubPat is 1X or X2 THEN classify as Banker Draw and hedge as 1X or X2. NO STRAIGHT DRAWS.
    if (!isNaN(oX) && oX < 3.25 && rulePrediction && ['1X', 'X2'].includes(rulePrediction)) {
        // Only trigger if not already a Banker Draw or if we want to override
        if (category !== 'Banker Draw') {
            category = 'Banker Draw';
            // Hedge based on favorite or probabilities
            if (finalPrediction === 'X') {
                 finalPrediction = p1 >= p2 ? '1X' : 'X2';
            } else if (finalPrediction.length === 1) {
                 finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            }
            reasonParts.push("Banker Draw ID (Tight Odds)");
        } else {
            // Ensure no straight draw if already Banker Draw
            if (finalPrediction === 'X') {
                finalPrediction = p1 >= p2 ? '1X' : 'X2';
                reasonParts.push("Banker Draw Hedge Enforced");
            }
        }
    }

    // [PROTOCOL: Value Bet Stabilization]
    // IF match is a Value Bet AND Algo Prediction > 60%, THEN retain current hedge strategy but penalize conflicting PHA probabilities.
    if (category === 'Value' && maxP > 0.60) {
        if (sSubStatsProb) {
            const phaDir = sSubStatsProb['1'] > sSubStatsProb['2'] ? '1' : '2';
            // If PHA contradicts Algo (finalPrediction)
            if (!matchesPrediction(finalPrediction, phaDir)) {
                 // Penalize: Downgrade confidence or force hedge if not already hedged
                 rawConfidence = Math.min(rawConfidence, 60);
                 if (finalPrediction.length === 1) {
                     finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                     reasonParts.push("Value Stabilization (PHA Conflict)");
                 }
            }
        }
    }

    // [PROTOCOL: Value Pick Holy Grail Protocol]
    // IF match is a Value Pick, THEN Algo Prediction MUST be >= 50% for the straight outcome AND Sub Pattern Prediction MUST NOT contradict the straight bet. NO straight bets on < 50% Algo Prediction.
    if (category === 'Value') {
        if (finalPrediction.length === 1) {
            if (maxP < 0.50) {
                // Downgrade to hedge or Standard
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                category = 'Standard';
                reasonParts.push("Value Holy Grail Fail (<50%)");
            } else if (rulePrediction && !matchesPrediction(rulePrediction, finalPrediction)) {
                // SubPat contradicts
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
                category = 'Standard';
                reasonParts.push("Value Holy Grail Fail (SubPat Conflict)");
            }
        }
    }

    // [PROTOCOL: Banker Draw Identification and Hedging (New)]
    // IF PHA Draw Probability > 35% AND Algo Prediction shows no clear favorite, THEN classify as Banker Draw AND apply 1X or X2 hedge based on the slight favorite. NEVER predict a straight X.
    // "No clear favorite" defined as maxP < 0.50
    const phaDrawProb = sSubStatsProb ? sSubStatsProb['X'] : 0;
    if (phaDrawProb > 0.35 && maxP < 0.50) {
        // Classify as Banker Draw
        category = 'Banker Draw';
        // Apply 1X or X2 hedge based on slight favorite (p1 vs p2)
        finalPrediction = p1 >= p2 ? '1X' : 'X2';
        reasonParts.push("Banker Draw Hedge (PHA > 35%)");
    }

    // [PROTOCOL: Upset Detection Overhaul]
    // IF Underdog Odds > 2.5 AND PHA support for Underdog > 60%, THEN classify as Upset AND hedge towards the underdog.
    if (moUnderdog && sSubStatsProb) {
        const udOdds = moUnderdog === '1' ? o1 : o2;
        const phaUdSupport = sSubStatsProb[moUnderdog as '1'|'2'];
        
        if (!isNaN(udOdds) && udOdds > 2.50 && phaUdSupport > 0.60) {
            category = 'Upset';
            finalPrediction = moUnderdog === '1' ? '1X' : 'X2';
            reasonParts.push("Upset Overhaul (PHA > 60%)");
        }
    }

    // [PROTOCOL: Sub-Pattern and Algo Alignment]
    // IF Sub Pattern Prediction contradicts Algo Prediction on a Banker, THEN flag match for manual review or apply a double chance hedge covering both signals.
    if (category === 'Banker' && rulePrediction) {
        if (!matchesPrediction(rulePrediction, finalPrediction)) {
            // Contradiction detected
            // Apply double chance hedge covering both? 
            // If Algo says 1, SubPat says X2 -> 1X? Or 12?
            // "apply a double chance hedge covering both signals"
            // If Algo=1, SubPat=2 -> 12. If Algo=1, SubPat=X -> 1X.
            
            // Simplest safe approach: Downgrade to Standard and ensure Hedge
            category = 'Standard';
            if (finalPrediction.length === 1) {
                finalPrediction = finalPrediction === '1' ? '1X' : 'X2';
            }
            reasonParts.push("SubPat/Algo Alignment Fail");
        }
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
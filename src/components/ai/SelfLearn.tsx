
import { Match, AIAnalysisArchive } from '../../types';
import { matchAlgorithm } from './algorithm';
import { getActualResult, matchesPrediction } from '../../utils/matchProcessing';
import { normalizeTeamName } from './GeminiEngine';
import { Pick } from './GeminiCards';
import { DAILY_CRITERIA, JACKPOT_CRITERIA } from '../MatchSelector';
import { SUB_PATTERN_RULES } from '../Patterns';

// Helper to get outcome stats
const getOutcomeStats = (subset: Match[]) => {
    const completed = subset.filter(m => getActualResult(m.result) !== 'pending');
    const total = completed.length;
    if(total === 0) return { total: 0, p1: 0, pX: 0, p2: 0 };
    const c1 = completed.filter(m => getActualResult(m.result) === '1').length;
    const cX = completed.filter(m => getActualResult(m.result) === 'X').length;
    const c2 = completed.filter(m => getActualResult(m.result) === '2').length;
    return { 
        total, 
        p1: Math.round((c1/total)*100), 
        pX: Math.round((cX/total)*100), 
        p2: Math.round((c2/total)*100) 
    };
};

const analyzeCondition = (matches: Match[], conditionFn: (m: Match) => boolean, label: string) => {
    const subset = matches.filter(conditionFn);
    const stats = getOutcomeStats(subset);
    return { label, ...stats };
};

export const generateSelfLearnPrompt = (
    trainingSet: Match[],
    fullHistory: Match[] | undefined,
    aiHistory: AIAnalysisArchive[],
    selfLearnStrategy: string
) => {
    
    // Use full history if available for deeper learning
    const dataset = fullHistory && fullHistory.length > 0 ? fullHistory : trainingSet;
    const completed = dataset.filter(m => getActualResult(m.result) !== 'pending');

    const coreMandates = `
    **CORE AI MANDATES (STRICT ENFORCEMENT)**:
    1. **AI-CALCULATED CONFIDENCE**: The AI MUST calculate its own **Match Confidence** (0-100%) by combining:
       - Point System (Differential & Parity)
       - Sub Pattern Prediction (Rule-based signal)
       - Algo Prediction & Probabilities (Baseline signal)
       - PHA (Pattern Historical Accuracy - 1X2 history)
       - PAA (Pattern Accuracy Audit - Fav/Upset history)
       - Team Strength (TS) parity and PHA/PAA sample size maturity.
    2. **BANKER DRAWS HEDGING (JACKPOT SLIP)**: Matches with 'banker_draws' tags have a 75% historical draw probability. The AI should predict **Straight X (Unhedged Draw)** on the Jackpot Slip ONLY when data (PHA, PAA, Algo, TS) confirms high deadlock potential. Otherwise, it MUST HEDGE (1X or X2).
    3. **BANKERS JACKPOT HEDGING**: On the Jackpot Slip, Bankers Jackpot matches MUST be HEDGED (1X or X2) to cover draw frequency, even if unhedged on their own category slip.
    4. **UPSET HEDGING**: Predict unhedged or X2/1X when sure of an upset; otherwise, hedge '12' when confidence is low.
    5. **DEPRIORITIZATION RULES (DAILY LIVE)**:
       - Deprioritize matches in Pattern Groups **R, t, y, nn, and n** for Bankers, Top 10, BOTB, Value Picks, and Top 20.
       - Deprioritize matches where **Underdog PHA Support == Draw PHA Support ±1%** for the same categories.
       - Deprioritized matches can still be selected if data is exceptionally strong and stars are good, but AI MUST be cautious.
       - **PAA GATE**: Strictly deprioritize matches for straight-win categories if PAA Fav Win Rate < 50%.
    `;

    let strategyContext = "";
    let specificPrompt = "";
    let strategiesData: any[] = [];

    if (selfLearnStrategy === 'points_system') {
        // --- POINTS SYSTEM LOGIC UPDATE ---
        
        // Analyze current accuracy (post-implementation)
        const totalMatches = completed.length;
        const pointsCorrect = completed.filter(m => matchesPrediction(m.calculatedPrediction || '', getActualResult(m.result))).length;
        
        // Metric: High Confidence Points > 70
        const highPoints = completed.filter(m => (m.maxPoints || 0) > 70);
        const highPointsCorrect = highPoints.filter(m => matchesPrediction(m.calculatedPrediction || '', getActualResult(m.result))).length;

        strategyContext = `
        **POINTS SYSTEM STATUS REPORT**:
        - **Current Performance**:
          - Overall Accuracy: ${totalMatches > 0 ? Math.round((pointsCorrect/totalMatches)*100) : 0}% (${pointsCorrect}/${totalMatches})
          - High Confidence (>70 pts) Accuracy: ${highPoints.length > 0 ? Math.round((highPointsCorrect/highPoints.length)*100) : 0}%
        `;

        specificPrompt = `
            **STRATEGY: POINTS SYSTEM DYNAMIC EVOLUTION**
            GOAL: Transform the Points System from a static calculator to a **Context-Aware Engine**.
            ADDRESS RECOMMENDATIONS TO: **System Architect**.
            
            **MANDATORY TASK: DYNAMIC SCORING RULES**
            Identify specific scenarios where the standard weighting (MO=25, GS=20, etc.) is suboptimal and propose **Dynamic Multipliers**.
            
            **OUTPUT REQUIREMENTS (At least 5 Rules)**:
            1. **League-Specific Weights**: "If League is High Scoring (e.g. Bundesliga), increase GS/GA weights by 1.5x and reduce MO by 0.5x."
            2. **Volatility Penalties**: "If Group = 2 AND Away Odds < 2.50, apply a -10pt penalty to Home Score to dampen false confidence."
            3. **The 'Form' Booster**: "If L10 Diff > 5 pts, double the L10 weight (16pts max)."
            4. **Deadlock Detection**: "If TS Diff < 0.1 AND MO Diff < 0.2, Boost Draw Score by +15 pts."
            
            **FORMULAIC OUTPUT**:
            "IF [Condition] THEN [Action on Points Weights/Scores]"
        `;

    } else if (selfLearnStrategy === 'match_selector') {
        // --- MATCH SELECTOR GENIUS ---
        // 1. Run Audit on History using evaluateMatchQuality
        const auditResults = completed.map(m => {
            const quality = matchAlgorithm.evaluateMatchQuality(m);
            const actual = getActualResult(m.result);
            const pred = m.finalPrediction || 'NA';
            const isCorrect = matchesPrediction(pred, actual);
            
            // Infer likely category based on match attributes for context
            let impliedCategory = 'General';
            const conf = matchAlgorithm.predict(m).rawConfidence;
            const minO = Math.min(...(m.mo?.split(',').map(s => parseFloat(s))||[0]));
            
            if (m.isJackpot) impliedCategory = 'Jackpot Slip';
            else {
                if (minO >= 1.35 && minO <= 1.60 && conf > 75) impliedCategory = 'Bankers';
                else if (minO >= 2.0 && minO <= 2.50) impliedCategory = 'Value Picks';
                else if (minO > 2.50) impliedCategory = 'Upsets'; // simplified
                else if (quality.score > 80) impliedCategory = 'Top 10';
                else if (quality.score > 60) impliedCategory = 'BOTB';
            }

            return {
                match: m.teams,
                odds: m.mo,
                group: m.group,
                qualityScore: quality.score,
                qualified: quality.isQualified,
                rejectReason: quality.reason,
                prediction: pred,
                result: actual,
                correct: isCorrect,
                impliedCategory
            };
        });

        const qualifiedMatches = auditResults.filter(r => r.qualified);
        const qualifiedCorrect = qualifiedMatches.filter(r => r.correct).length;
        const accuracy = qualifiedMatches.length > 0 ? Math.round((qualifiedCorrect/qualifiedMatches.length)*100) : 0;

        const falsePositives = qualifiedMatches.filter(r => !r.correct).slice(0, 20); // Top failures
        const falseNegatives = auditResults.filter(r => !r.qualified && r.correct && r.qualityScore > 30).slice(0, 20); // Missed wins (with decent score)

        const criteriaTextDaily = DAILY_CRITERIA.map(c => `${c.title}:\nRULES: ${c.rules.join(' ')}`).join('\n\n');
        const criteriaTextJackpot = JACKPOT_CRITERIA.map(c => `${c.title}:\nRULES: ${c.rules.join(' ')}`).join('\n\n');

        strategyContext = `
        **CURRENT MATCH SELECTOR PERFORMANCE**
        - Accuracy: ${accuracy}%
        
        **CURRENT CRITERIA (DAILY)**:
        ${criteriaTextDaily}

        **CURRENT CRITERIA (JACKPOT)**:
        ${criteriaTextJackpot}

        **FALSE POSITIVES (Qualified but LOST)**:
        ${JSON.stringify(falsePositives.map(f => ({ m: f.match, cat: f.impliedCategory, reason: "Passed Criteria", odds: f.odds, res: f.result, pred: f.prediction })))}

        **FALSE NEGATIVES (Disqualified but WON)**:
        ${JSON.stringify(falseNegatives.map(f => ({ m: f.match, cat: f.impliedCategory, reason: f.rejectReason, odds: f.odds, res: f.result })))}
        `;

        specificPrompt = `
            **STRATEGY: MATCH SELECTION 'KILL SWITCH' PROTOCOLS**
            GOAL: Eliminate False Positives by identifying hidden toxicity markers.
            
            **MANDATORY OUTPUT**: **10+ Recommendations**.
            
            **ANALYSIS FOCUS**:
            1. **The 'Good on Paper' Trap**: Look at the False Positives. Did they have high Algo Confidence? Good Odds? Why did they fail?
               - *Action*: Create a **'Kill Switch'** rule. E.g., "IF Group 2 AND Away Odds < 2.00 AND TS Diff < 1.0 -> DISQUALIFY."
            2. **The 'Missed Gem'**: Look at False Negatives. Were they rejected due to "Low Points" or "TS Opposes"?
               - *Action*: Create an **'Exception Clause'**. E.g., "IF PHA Support > 60%, IGNORE TS Opposition."
            
            **STRUCTURE**:
            - **COMPONENT**: "Daily" or "Jackpot".
            - **CATEGORY**: Target List (e.g. "Bankers").
            - **ACTION**: "Kill Switch" or "Exception Clause".
            - **RULE**: "IF [Specific Condition with Thresholds] THEN [Disqualify/Qualify]".
        `;

    } else if (selfLearnStrategy === 'ai_filters') {
        // --- NEW AI FILTERS LOGIC ---
        const filterData = completed.map(m => {
            const pred = matchAlgorithm.predict(m);
            const probs = pred.probabilities;
            const phaStats = matchAlgorithm.getRawPatternStats(`S:${m.patternAnalysis?.subPattern}`);
            
            const moParts = m.mo?.split(',').map(s => parseFloat(s)) || [];
            let moFav = 'None';
            if(moParts.length >= 3) {
                const min = Math.min(...moParts.filter(n => !isNaN(n)));
                if(min === moParts[0]) moFav = '1';
                else if(min === moParts[2]) moFav = '2';
            }

            let phaFav = 'None';
            if(phaStats && phaStats.total >= 3) {
                const max = Math.max(phaStats.outcomes['1'], phaStats.outcomes['X'], phaStats.outcomes['2']);
                if(max === phaStats.outcomes['1']) phaFav = '1';
                else if(max === phaStats.outcomes['2']) phaFav = '2';
                else phaFav = 'X';
            }

            return {
                id: m.id,
                res: getActualResult(m.result),
                p1: probs['1'].toFixed(2),
                pX: probs['X'].toFixed(2),
                p2: probs['2'].toFixed(2),
                moFav,
                phaFav
            };
        }).slice(0, 300); 

        strategyContext = `
        **DATASET FOR AI FILTER CREATION (n=${filterData.length})**
        Format: { ID, Result, Prob_1, Prob_X, Prob_2, Market_Fav, PHA_Fav }
        ${JSON.stringify(filterData)}
        `;

        specificPrompt = `
            **STRATEGY: HYBRID SIGNAL DISCOVERY**
            GOAL: Create complex "Golden Combination" filters that identify near-certainties.
            ADDRESS RECOMMENDATIONS TO: **General Algorithm / AI Filters Module**.

            **TASK**:
            Find combinations of **Algo Probability + Market Structure + PHA** that yield > 90% accuracy.
            
            **NEW FILTER TYPES**:
            1. **The 'GC_LOCK'**: Where P_FAV > 0.50 AND PHA_FAV == MO_FAV AND PHA_VAL > 0.60.
            2. **The 'TRAP_MASTER'**: Where MO_FAV != PHA_FAV AND P_UND > 0.40 -> Predict Underdog.
            3. **The 'DEADLOCK'**: Where P_DRAW > 0.33 AND MO_FAV is Weak (> 2.10) -> Predict Draw.
            
            **OUTPUT FORMAT**:
            "NAME: [Filter Name] | FORMULA: IF [Exact Logic] | ACTION: [Predict...] | REASONING: [...]"
            
            Provide 5 NEW, ADVANCED filters with EXACT logic thresholds.
        `;

    } else if (selfLearnStrategy === 'jackpot_audit') {
        const jackpotMatches = completed.filter(m => m.isJackpot);
        const total = jackpotMatches.length;
        
        let algoCorrect = 0;
        let phaCorrect = 0;
        let moCorrect = 0;
        let goldenComboCount = 0;
        let goldenComboCorrect = 0;

        jackpotMatches.forEach(m => {
            const result = getActualResult(m.result);
            const algoPred = matchAlgorithm.predict(m).prediction;
            if (matchesPrediction(algoPred, result)) algoCorrect++;

            const subPred = m.patternAnalysis?.subPatternPrediction;
            if (subPred && matchesPrediction(subPred, result)) phaCorrect++;

            const moParts = m.mo?.split(',').map(s => parseFloat(s)) || [];
            if (moParts.length >= 3) {
                const minO = Math.min(...moParts.filter(n => !isNaN(n)));
                let moPred = '';
                if (minO === moParts[0]) moPred = '1';
                else if (minO === moParts[2]) moPred = '2';
                else moPred = 'X';
                if (matchesPrediction(moPred, result)) moCorrect++;

                const phaStats = matchAlgorithm.getRawPatternStats(`S:${m.patternAnalysis?.subPattern}`);
                if (phaStats && phaStats.total > 2) {
                    const p1 = phaStats.outcomes['1'];
                    const pX = phaStats.outcomes['X'];
                    const p2 = phaStats.outcomes['2'];
                    const maxP = Math.max(p1, pX, p2);
                    let phaPred = '';
                    if (maxP === p1) phaPred = '1';
                    else if (maxP === pX) phaPred = 'X';
                    else phaPred = '2';

                    if (phaPred === moPred && phaPred === subPred) {
                        goldenComboCount++;
                        if (matchesPrediction(phaPred, result)) goldenComboCorrect++;
                    }
                }
            }
        });

        strategyContext = `
        **JACKPOT AUDIT (n=${total})**
        - Algo Accuracy: ${total > 0 ? Math.round((algoCorrect/total)*100) : 0}%
        - PHA Accuracy: ${total > 0 ? Math.round((phaCorrect/total)*100) : 0}%
        - MO Accuracy: ${total > 0 ? Math.round((moCorrect/total)*100) : 0}%
        
        **GOLDEN COMBO (MO+PHA+Sub)**
        - Occurrences: ${goldenComboCount}
        - Accuracy: ${goldenComboCount > 0 ? Math.round((goldenComboCorrect/goldenComboCount)*100) : 0}%
        `;

        specificPrompt = `
            **STRATEGY: JACKPOT SLIP PERFECTION**
            GOAL: Maximize the 13/13 or 17/17 hit rate by optimizing the **Base vs Hedge** structure.
            ADDRESS RECOMMENDATIONS TO: **Jackpot Component**.
            
            **TASKS**:
            1. **Golden Base**: If Golden Combo accuracy > 85%, mandate it as a 'Fixed Single' to save hedges for riskier games. Define the exact threshold.
            2. **The '12' Problem**: Analyze '12' predictions in Jackpot. Are they hitting? Or should we force '1X/X2' based on Team Strength bias? Define the **'Jackpot 12 Protocol'** with strict IF/THEN logic.
            3. **Draw Mastery**: When should we *attack* the Draw (Single X) vs *cover* the Draw (1X/X2)? Define the **'Aggressive Draw'** threshold (e.g., "IF Odds Diff < 0.2 AND PHA Draw > 35%").
        `;

    } else if (selfLearnStrategy === 'pha') {
        const validPHA = completed.filter(m => {
            const stats = matchAlgorithm.getRawPatternStats(`S:${m.patternAnalysis?.subPattern}`);
            return stats && stats.total >= 3;
        });

        // PHA vs MO Conflict
        const conflicts = validPHA.filter(m => {
            const stats = matchAlgorithm.getRawPatternStats(`S:${m.patternAnalysis?.subPattern}`);
            const max = Math.max(stats!.outcomes['1'], stats!.outcomes['X'], stats!.outcomes['2']);
            let phaPred = '';
            if (max === stats!.outcomes['1']) phaPred = '1';
            else if (max === stats!.outcomes['2']) phaPred = '2';
            
            const parts = m.mo?.split(',') || [];
            if (parts.length < 3) return false;
            const minO = Math.min(...parts.map(parseFloat));
            let moPred = '';
            if (minO === parseFloat(parts[0])) moPred = '1';
            else if (minO === parseFloat(parts[2])) moPred = '2';

            return phaPred && moPred && phaPred !== moPred;
        });
        
        const conflictPhaWin = conflicts.filter(m => {
             const stats = matchAlgorithm.getRawPatternStats(`S:${m.patternAnalysis?.subPattern}`);
             const max = Math.max(stats!.outcomes['1'], stats!.outcomes['2']); // Ignore X for binary conflict
             const phaPred = max === stats!.outcomes['1'] ? '1' : '2';
             return matchesPrediction(phaPred, getActualResult(m.result));
        }).length;

        strategyContext = `
        **PHA DEEP DIVE**
        - PHA vs MO Conflicts: ${conflicts.length}
        - PHA Win Rate in Conflicts: ${conflicts.length > 0 ? Math.round((conflictPhaWin/conflicts.length)*100) : 0}%
        `;

        specificPrompt = `
            **STRATEGY: THE CONTRARIAN THRESHOLD**
            GOAL: Mathematically define when to ignore the Market Favorite in favor of History.
            ADDRESS RECOMMENDATIONS TO: **General Algorithm**.
            
            **TASK**:
            Define the **'PHA Veto'**. 
            "IF PHA Support for Underdog > X% AND Market Favorite Odds > Y, THEN Predict Underdog."
            Find X and Y based on the conflict win rate in the provided data.
            
            **OUTPUT FORMAT**:
            "IF PHA_Underdog > [Percentage]% AND Fav_Odds > [Value] THEN FORCE_PREDICTION = [Underdog]"
        `;

    } else if (selfLearnStrategy === 'value_picks') {
        const decisiveOpportunities = completed.filter(m => matchAlgorithm.predict(m).rawConfidence >= 70);
        const highOddsDecisive = decisiveOpportunities.filter(m => {
            const minO = Math.min(...(m.mo?.split(',').map(s => parseFloat(s)) || [0]));
            return minO >= 2.0;
        });
        
        const highStats = getOutcomeStats(highOddsDecisive);
        
        // Generate detailed dataset for AI analysis
        const valuePickData = highOddsDecisive.map(m => {
            const pred = matchAlgorithm.predict(m);
            const phaStats = matchAlgorithm.getRawPatternStats(`S:${m.patternAnalysis?.subPattern}`);
            const phaSupport = phaStats && phaStats.total > 0 ? 
                Math.max(phaStats.outcomes['1'], phaStats.outcomes['2']) : 0;
            
            return {
                id: m.id,
                res: getActualResult(m.result),
                odds: m.mo,
                algoConf: pred.rawConfidence,
                phaSupport: phaSupport,
                subPat: m.patternAnalysis?.subPattern
            };
        }).slice(0, 100); // Limit to 100 for context window

        strategyContext = `
        **VALUE PICKS (DECISIVE)**
        - High Odds (>=2.0) Decisive Matches: ${highOddsDecisive.length}
        - Win Rate: ${highStats.p1 + highStats.p2}% (Singles)
        
        **DETAILED DATASET (Sample)**:
        ${JSON.stringify(valuePickData)}
        `;

        specificPrompt = `
            **STRATEGY: VALUE PICKS OVERHAUL (THE HOLY GRAIL)**
            GOAL: Achieve consistent 80%+ accuracy on Value Picks (High Odds Singles).
            ADDRESS RECOMMENDATIONS TO: **Daily Live (Value Picks)**.
            
            **CRITICAL TASK**:
            1. **Thorough Upgrade**: Analyze the failures in the provided dataset. Why are we missing? Is it the Odds floor? The PHA threshold?
            2. **Streamline Priorities**: Review existing priorities (PR1, PR2, etc.). Are they effective? If not, recommend modifying them.
            3. **New Priorities**: Propose NEW, specific priorities (e.g., PR3, PR4, PR11) based on "Golden Combinations" of Algo Confidence + PHA Support + Market Odds.
               - **NEW PROTOCOL**: IF Category == 'Value Picks' AND SubPat == '12' AND Home_Odds < 2.5 AND Actual_PHA_Away > 45%, THEN Assign Value_PR.. = '2'.
            4. **The Solution**: Define the EXACT criteria (e.g., "Odds > 2.10 AND PHA > 65% AND Algo Conf > 80%") that guarantees a win.
            5. **Formulaic Output**: Your recommendations MUST be in the format: "IF [Condition 1] AND [Condition 2] THEN [Action]". Avoid vague advice.
        `;

    } else if (selfLearnStrategy === 'pattern_creator') {
        const targets = ['T', 'R', 'MM', 'NN', 'S', 'FF', 'U', 'N'];
        let candidates = trainingSet.filter(m => 
            targets.includes(m.patternAnalysis?.mainPattern || '') && 
            getActualResult(m.result) !== 'pending'
        );

        if (candidates.length < 10) {
            candidates = trainingSet.filter(m => getActualResult(m.result) !== 'pending');
        }

        const dataHeader = "ID,MainPat,SubPat,Flags,Res,CurrentPred,GS_H,GS_A,GA_H,GA_A,DiffGS,DiffGA,TSA,TSB,Group";
        const dataRows = candidates.map(m => {
            const gsH = m.gsHome || 0; const gsA = m.gsAway || 0;
            const gaH = m.gaHome || 0; const gaA = m.gaAway || 0;
            const result = getActualResult(m.result);
            const currentPred = m.finalPrediction || 'NA';
            const flags = m.patternAnalysis?.activeFlags?.join('+') || 'None';
            const subPat = m.patternAnalysis?.subPattern || 'None';
            return `${m.id},${m.patternAnalysis?.mainPattern},${subPat},${flags},${result},${currentPred},${gsH},${gsA},${gaH},${gaA},${(gsH-gsA).toFixed(1)},${(gaH-gaA).toFixed(1)},${m.tsa},${m.tsb},${m.group}`;
        }).slice(0, 200);

        // Calculate last IDs for continuation logic
        const lastIds: Record<string, number> = {};
        SUB_PATTERN_RULES.forEach(rule => {
            const key = `G${rule.group}${rule.mainPattern}`;
            const idNumMatch = rule.id.match(/(\d+)$/);
            if (idNumMatch) {
                const num = parseInt(idNumMatch[1]);
                if (!lastIds[key] || num > lastIds[key]) {
                    lastIds[key] = num;
                }
            }
        });

        const existingFlags = [
            'SHGS', 'ESHGS', 'WHGS', 'EWHGS', 'SAGS', 'ESAGS', 'WAGS', 'EWAGS',
            'SHGA', 'ESHGA', 'WHGA', 'EWHGA', 'SAGA', 'ESAGA', 'WAGA', 'EWAGA',
            'TSB_1', 'UPSET', 'POTENTIAL_DRAW', 'TS_DIFF_DRAW', 'TS_HOME_STRONG', 
            'H_BAL', 'A_BAL', 'HGS_STRONG', 'AGS_WEAK', 'HGA_LEAKY', 'LOW_OFFENSE', 
            'DEF_MISMATCH', 'BOTH_HIGH_SCORING', 'TS_HOME_DOMINANT', 'TS_AWAY_DOMINANT', 
            'VERY_LOW_OFFENSE', 'AWAY_TS_DOMINANCE_G1', 'GS_TIGHT', 'HGS_ABOVE_AVG', 
            'AGA_SOLID', 'HIGH_TOTAL_SCORING', 'TSB_GT_TSA', 'GS_HOME_ADV', 'TSA_HIGH', 
            'AGS_VERY_WEAK', 'LOW_TOTAL_SCORING', 'TSA_GT_1', 'TS_TIGHT', 'HGS_POOR', 
            'GS_STALEMATE', 'HGS_ELITE', 'HGA_IRON', 'AGS_STRONG', 'HGS_GOOD', 
            'AWAY_DEF_BETTER', 'HGS_WEAK', 'TSB_SOLID', 'GS_EXACT_EQUAL', 'AGS_GT_HGS', 
            'TSA_GT_1_3', 'GS_NEAR_EQUAL', 'GS_AWAY_LEAN', 'GS_AWAY_ADV', 'HGS_LOW_1_2', 
            'TSA_WEAK_0_8', 'AGS_DECENT_1_0', 'HOME_DEF_BETTER', 'HOME_DEF_STRICT', 
            'HGS_LT_1_5', 'GS_HOME_DOMINANT_1', 'TSA_LT_1', 'AGA_LT_1_5', 'HGS_LT_0_8', 'HGA_LT_1_5'
        ];

        strategyContext = `
        **PATTERN CREATOR DATASET**
        Count: ${candidates.length}
        CSV:
        ${dataHeader}
        ${dataRows.join('\n')}

        **LAST SUB-PATTERN IDS (FOR CONTINUATION)**:
        ${JSON.stringify(lastIds)}

        **EXISTING FLAGS (MANDATORY: DO NOT CREATE NEW FLAGS)**:
        ${existingFlags.join(', ')}
        `;

        specificPrompt = `
            **STRATEGY: PATTERN CREATOR & RE-CATEGORIZATION**
            GOAL: Ensure every match is assigned to the most precise Sub-Pattern based on ALL active flags.
            ADDRESS RECOMMENDATIONS TO: **System Architect**.

            **CRITICAL TASKS**:
            1. **Identify Flag Mismatches**: Find matches where the 'Flags' column contains multiple flags but the 'SubPat' only captures a subset of them.
            2. **Re-categorization**: If a sub-pattern already exists in the same Group and MainPattern that matches the full flag set, recommend moving the match to that sub-pattern.
            3. **New Sub-Pattern Creation**: 
               - For matches with 'SubPat' = 'None' (defaulting to main patterns), recommend creating a new Sub-Pattern.
               - If a match has a unique combination of flags that isn't captured by any existing sub-pattern, recommend creating a new one.
            4. **Refine Existing Sub-Patterns**: Recommend updating existing sub-patterns to include missing flags if they are consistently present in winning matches.

            **STRICT RULES FOR NEW SUB-PATTERNS**:
            - **NO NEW FLAGS**: You MUST ONLY use flags from the "EXISTING FLAGS" list provided. Do NOT invent or hallucinate new flags.
            - **ID CONTINUATION**: New IDs MUST follow the format G{Group}{MainPattern.toLowerCase()}{Number}. 
              - The {Number} MUST be the next sequential number after the last ID provided for that Group and MainPattern.
              - Example: If last ID for G3S is 16, the new ID MUST be G3s17.
            - **ORDERING**: New sub-patterns with MORE flags should be recommended to be placed BEFORE those with fewer flags in the same group.

            **OUTPUT FORMAT**:
            - **RE-CATEGORIZE**: "Match [ID] should move from [Old SubPat] to [New SubPat] because it has flags [Flags]."
            - **CREATE NEW**: "Create Sub-Pattern [New ID] for MainPattern [MainPat] in Group [Group] with Flags [Flags]. Recommended Prediction: [1/X/2/1X/X2/12]."
            - **IMPROVE**: "Update Sub-Pattern [ID] to include Flag [Missing Flag]."
        `;

    } else if (selfLearnStrategy === 'banker') {
        const potentialBankers = completed.filter(m => {
            const conf = matchAlgorithm.predict(m).rawConfidence;
            const minO = Math.min(...(m.mo?.split(',').map(s => parseFloat(s)) || [0]));
            return minO >= 1.35 && conf >= 70;
        });

        const lowOddsSingles = potentialBankers.filter(m => {
            const parts = m.mo?.split(',') || [];
            const minO = Math.min(...parts.map(parseFloat));
            return minO >= 1.35 && minO < 2.00;
        });
        const lowOddsSingleStats = getOutcomeStats(lowOddsSingles);
        const lowOddsWinRate = lowOddsSingleStats.total > 0 ? (100 - lowOddsSingleStats.pX) : 0; 

        strategyContext = `
        **BANKER OPTIMIZATION**
        - Low Odds Singles (1.35-1.99): ${lowOddsSingles.length} matches. Win Rate: ${lowOddsWinRate}%.
        `;

        specificPrompt = `
            **STRATEGY: BANKER FORTIFICATION**
            GOAL: 100% Accuracy on Bankers.
            ADDRESS RECOMMENDATIONS TO: **Daily Live (Bankers)**.
            
            **TASKS**:
            1. **Challenge the 1.35 Floor**: Should we raise it to 1.45 to avoid "odd traps"? Or lower it but require 90% Conf? Provide data-backed recommendation.
            2. **Draw Filter**: Identify Bankers that ended in a Draw. Did they have a 'Potential Draw' flag? Create a strict **'Draw Flag Disqualification'** rule (e.g., "IF Potential Draw Flag AND Odds > 1.30 -> DISQUALIFY").
            3. **The '100% Protocol'**: Define a set of conditions that has historically yielded 100% accuracy for Bankers.
        `;

    } else if (selfLearnStrategy === 'value_bets') {
        const valueWins = completed.filter(m => {
            const res = getActualResult(m.result);
            const parts = m.mo?.split(',') || [];
            const o1 = parseFloat(parts[0]); const o2 = parseFloat(parts[2]);
            if (res === '1' && o1 >= 2.0) return true;
            if (res === '2' && o2 >= 2.0) return true;
            return false;
        });

        strategyContext = `
        **VALUE BETS OPTIMIZATION**
        - Total High Odds Winners: ${valueWins.length}
        `;

        specificPrompt = `
            **STRATEGY: PROFITABLE SIDE TARGETING**
            GOAL: Identify which side (Home Underdog vs Away Underdog) is more profitable.
            ADDRESS RECOMMENDATIONS TO: **Daily Live**.
            
            **TASK**:
            Analyze the Value Bet winners.
            - Are **Home Underdogs** more reliable than Away Underdogs?
            - Define a **'Minimum Probability Floor'** (e.g. Algo Prob > 35%) required to bet on an underdog.
            - **Output**: "IF Value Bet AND [Home/Away] Underdog AND Algo Prob > [X]% THEN [Action]"
        `;

    } else if (selfLearnStrategy === 'upset') {
        const upsetMatches = completed.filter(m => {
            const res = getActualResult(m.result);
            const parts = m.mo?.split(',') || [];
            if(parts.length < 3) return false;
            const o1 = parseFloat(parts[0]); const o2 = parseFloat(parts[2]);
            const fav = o1 <= o2 ? '1' : '2';
            return res !== 'X' && res !== fav;
        });

        // Generate detailed dataset for AI analysis
        const upsetData = upsetMatches.map(m => {
            const pred = matchAlgorithm.predict(m);
            const phaStats = matchAlgorithm.getRawPatternStats(`S:${m.patternAnalysis?.subPattern}`);
            const parts = m.mo?.split(',') || [];
            const o1 = parseFloat(parts[0]); const o2 = parseFloat(parts[2]);
            const fav = o1 <= o2 ? '1' : '2';
            const underdog = fav === '1' ? '2' : '1';
            
            const phaUnderdogSupport = phaStats && phaStats.total > 0 ? phaStats.outcomes[underdog] : 0;

            return {
                id: m.id,
                res: getActualResult(m.result),
                favOdds: fav === '1' ? o1 : o2,
                undOdds: fav === '1' ? o2 : o1,
                algoConf: pred.rawConfidence,
                phaUndSupport: phaUnderdogSupport,
                subPat: m.patternAnalysis?.subPattern,
                subPatPred: m.patternAnalysis?.subPatternPrediction
            };
        }).slice(0, 100);

        strategyContext = `
        **UPSET STRATEGY**
        - Total Upsets: ${upsetMatches.length}
        
        **DETAILED DATASET (Sample)**:
        ${JSON.stringify(upsetData)}
        `;

        specificPrompt = `
            **STRATEGY: UPSET SEEKER REVOLUTION**
            GOAL: Achieve consistent 80%+ accuracy on Upset Predictions.
            ADDRESS RECOMMENDATIONS TO: **Daily Live / General**.
            
            **CRITICAL TASK**:
            1. **Deep Research**: Analyze the successful Upsets in the provided dataset. What was the common denominator? (e.g., Sub-Pattern X2, PHA Away > 40%, Fav Odds drifting?).
            2. **Priority Streamlining**: Review current Upset priorities. Eliminate weak ones.
               - **NEW PROTOCOL**: FOR PR1 TO PR9 IN Upsets: IF Rule CONTAINS 'Moderate PHA' AND DOES NOT REQUIRE Odds > 2.5, THEN DEACTIVATE Rule.
            3. **New Priorities**: Create NEW priorities (e.g., PR10, PR11) that target specific "Trap Favorite" scenarios.
            4. **The Solution**: Provide a concrete, workable solution to identify Upsets with high precision.
            5. **Formulaic Output**: Your recommendations MUST be in the format: "IF [Condition 1] AND [Condition 2] THEN [Action]". Avoid vague advice.
        `;

    } else if (selfLearnStrategy === 'draw') {
        const draws = completed.filter(m => getActualResult(m.result) === 'X');
        const drawSignals = [
            analyzeCondition(draws, m => m.patternAnalysis?.activeFlags.includes('POTENTIAL_DRAW') || false, "Potential Draw Flag"),
            analyzeCondition(draws, m => {
                const rel = matchAlgorithm.getPatternReliability(m.patternAnalysis?.subPattern || null);
                return rel.includes("X:") && parseInt(rel.split("X:")[1]) > 30;
            }, "PHA Draw > 30%")
        ];

        strategyContext = `
        **DRAW SEEKER**
        - Total Draws: ${draws.length}
        - Signal Presence in Draws:
        ${drawSignals.map(s => `${s.label}: ${s.total} hits`).join('\n')}
        `;

        specificPrompt = `
            **STRATEGY: STALEMATE SIGNATURES**
            GOAL: Accurately predict 'X' straight up.
            ADDRESS RECOMMENDATIONS TO: **General / Jackpot**.
            
            **TASK**:
            Identify the **'Boring Draw'** signature.
            - Look for combinations of **Low GS (both < 1.0)** and **High TS Parity**.
            - Identify **'Banker Killers'**: Draws that occurred in matches with < 1.50 Fav Odds. Create a flag for these (e.g., "IF Odds < 1.50 AND PHA Draw > 25% -> FLAG 'Banker Killer'").
        `;

    } else if (selfLearnStrategy === 'hedge') {
        const failedSingles = completed.filter(m => {
            const pred = matchAlgorithm.predict(m).prediction;
            return pred.length === 1 && !matchesPrediction(pred, getActualResult(m.result));
        });

        const breakdowns = [
            analyzeCondition(failedSingles, m => m.group === 1, "Group 1 Failures"),
            analyzeCondition(failedSingles, m => m.group === 2, "Group 2 Failures"),
            analyzeCondition(failedSingles, m => {
                const parts = m.mo?.split(',') || [];
                return Math.min(parseFloat(parts[0]), parseFloat(parts[2])) > 2.0;
            }, "High Odds Failures")
        ];

        strategyContext = `
        **HEDGE OPTIMIZATION**
        - Failed Single Bets: ${failedSingles.length}
        - Breakdown:
        ${breakdowns.map(b => `${b.label}: ${b.total}`).join('\n')}
        `;

        specificPrompt = `
            **STRATEGY: VOLATILITY SHIELD**
            GOAL: Eliminate Single Bet failures in danger zones.
            ADDRESS RECOMMENDATIONS TO: **General**.
            
            **TASK**:
            Analyze **'1X' Failures** (Away Wins).
            - Did the Away team have a specific **Team Strength** advantage that was ignored?
            - Define a rule to **Force Switch** from '1X' to '12' or 'X2' in these volatile Group 2 scenarios.
            - **Formula**: "IF Group 2 AND Prediction '1X' AND [Condition] THEN Switch to '12'"
        `;

    } else if (selfLearnStrategy === 'algo') {
        // --- DEEP ALGO AUDIT ---
        const algoAuditData = completed.map(m => {
            const stored = m.algoReport;
            const live = !stored ? matchAlgorithm.predict(m) : null;
            const pred = stored ? stored.prediction : live!.prediction;
            const conf = stored ? stored.confidence : live!.rawConfidence;
            const cat = stored ? stored.category : live!.category;
            const actual = getActualResult(m.result);
            const isCorrect = matchesPrediction(pred, actual);
            return { conf, isCorrect };
        });

        const elite = algoAuditData.filter(d => d.conf >= 90);
        const eliteCorrect = elite.filter(d => d.isCorrect).length;
        const eliteAcc = elite.length > 0 ? Math.round((eliteCorrect/elite.length)*100) : 0;

        strategyContext = `
        **ALGO INTEGRITY**
        - Elite Confidence (>90%) Accuracy: ${eliteAcc}% (${eliteCorrect}/${elite.length})
        `;

        specificPrompt = `
            **STRATEGY: CONFIDENCE DEFLATION**
            GOAL: Ensure '90% Confidence' actually means 90% Win Rate.
            ADDRESS RECOMMENDATIONS TO: **Algorithm Core**.
            
            **TASK**:
            If Elite Accuracy < 90%, the model is **Overconfident**.
            - Propose a **Dampening Factor**. Example: "Multiply Raw Confidence by 0.90 for Group 2 matches."
            - Identify where the overconfidence comes from (e.g., relying too much on Points?).
            - **Output**: "IF [Condition] THEN Apply Confidence Factor [0.X]"
        `;

    } else if (selfLearnStrategy === 'probability_review') {
        // --- PROBABILITY FORMULA REVIEW ---
        const calibrationData = completed.map(m => {
            const pred = matchAlgorithm.predict(m);
            return {
                probs: pred.probabilities,
                actual: getActualResult(m.result)
            };
        });

        strategyContext = `
        **PROBABILITY REVIEW (n=${calibrationData.length})**
        `;

        specificPrompt = `
            **STRATEGY: WEIGHT REDISTRIBUTION**
            GOAL: Fine-tune the 6-component probability formula.
            ADDRESS RECOMMENDATIONS TO: **System Formulas**.
            
            **TASK**:
            Compare the reliability of **'Sub-Pattern'** (current weight 7.0) vs **'Market Odds'** (weight 3.5).
            - If Sub-Patterns are failing, recommend **Shifting Weight** to Market Odds or Flag Consensus.
            - Propose a new specific Weighting Array.
            - **Output**: "Set SubPattern Weight = [X], Set Market Odds Weight = [Y]"
        `;

    } else if (selfLearnStrategy === 'system_rebuild') {
        const previousRebuilds = aiHistory.filter(h => h.mode === 'self_learn' && h.stats?.strategy === 'system_rebuild');
        let rebuildHistoryText = "";
        if (previousRebuilds.length > 0) {
            rebuildHistoryText = `\n**PREVIOUS SYSTEM REBUILD ITERATIONS:**\n`;
            previousRebuilds.slice(0, 3).forEach((h, i) => {
                rebuildHistoryText += `\n--- Iteration ${i + 1} (${new Date(h.date).toLocaleDateString()}) ---\n`;
                rebuildHistoryText += h.data.detailed_analysis.substring(0, 1500) + "...\n"; // Truncate to save tokens
            });
        }

        strategyContext = `
        **SYSTEM REBUILD PROTOCOL INITIATED**
        Total Historical Matches Available: ${trainingSet.length}
        ${rebuildHistoryText}
        `;

        specificPrompt = `
            **STRATEGY: SYSTEM REBUILD & MASTER PLAN**
            You are tasked with rebuilding the entire SEER.AI system from scratch by learning from past mistakes.
            The current system has achieved 90% accuracy, but we want you to build a replica of the system that is even better.
            By "building," we mean coming up with a comprehensive system plan, not writing the entire codebase.
            
            **YOUR OBJECTIVES:**
            1. Analyze the historical data, current formulas, and performance metrics.
            2. Develop better formulas by simulating building, testing, rebuilding, and testing until you conceptualize the most accurate formulas.
            3. Rebuild the point system and test it conceptually for maximum accuracy.
            4. Do the same for the Algorithm (Algo), Pattern Historical Analysis (PHA), AI Filters, Match Selectors, Sub-patterns, and Probability formulas.
            5. Come up with new, optimized formulas for Top 10, 11-20 (BOTB), Top 20, Value Bets, Bankers, and Upsets.
            
            **EXECUTION:**
            - Be extremely thorough.
            - Act as if you are running overnight tests to ensure maximum accuracy.
            - You may incorporate concepts from Jules, Skills, or Vertex AI to assist with this massive task.
            - Provide a detailed, step-by-step master plan for the new system architecture and formulas.
            - Output at least 10 highly detailed, actionable recommendations that redefine the core logic of the system.
            - If previous iterations are provided, build upon them and refine the formulas further.
        `;

    } else {
        // General / Other: Provide live category-based performance breakdown
        const liveTop10Matches = completed.filter(m => {
            return m.evaluatorTags?.some(t => t.startsWith('top10:')) || false;
        });
        const liveBankersMatches = completed.filter(m => {
            return m.evaluatorTags?.some(t => t.startsWith('bankers_dlive:')) || false;
        });

        const getCatStats = (matches: Match[]) => {
            let favW = 0, draw = 0, udW = 0;
            matches.forEach(m => {
                const res = getActualResult(m.result);
                const moParts = m.mo?.split(',').map(s => parseFloat(s)) || [];
                let favI = 0;
                if(moParts.length >= 3) {
                    favI = moParts[0] < moParts[2] ? 1 : 2;
                }
                if (res === 'X') draw++;
                else if (res === '1') { favI === 1 ? favW++ : udW++; }
                else if (res === '2') { favI === 2 ? favW++ : udW++; }
            });
            return `Total: ${matches.length} | Fav Wins: ${favW} | Draws: ${draw} | Underdog Wins: ${udW}`;
        };

        if (strategiesData.length === 0) {
             const stats = matchAlgorithm.getOptimizationData(trainingSet);
             strategyContext = `
             ${JSON.stringify(stats, null, 2)}
             
             **LIVE CATEGORY PERFORMANCE ANALYSIS (Full History n=${completed.length})**
             - **Top 10 Value / Live Analysis**: ${getCatStats(liveTop10Matches.length > 0 ? liveTop10Matches : completed.slice(0, 12))}
             - **Bankers**: ${getCatStats(liveBankersMatches.length > 0 ? liveBankersMatches : completed.slice(0, 10))}
             `;
        } else {
             strategyContext = strategiesData.map(s => `${s.label}: Total ${s.total} | 1: ${s.p1}% | X: ${s.pX}% | 2: ${s.p2}%`).join('\n');
        }
        specificPrompt = `
        Analyze Performance Stats. 
        **YOUR GOAL**: Do NOT give generic advice. Provide EXACT, DATA-DRIVEN, STRICT rules for selecting the Top 10 matches that will actually win. 
        If Top 10 has many draws/underdog wins (e.g., Fav Wins: 34, Draws: 29, Underdog: 39), provide STRICT hedging rules for Top 10.
        Ensure you tell the AI exactly WHEN to hedge 1X/X2 vs 12 based on the probabilities.
        `;
    }

    const systemInstruction = `
    You are the **Lead AI Algorithm Engineer (Gemini 3.1 Pro Agentic)**.
    
    ${coreMandates}

    CRITICAL: The stats provided are ACTUAL calculations based on full history.

    **YOUR PRIMARY DIRECTIVE: 100% ACCURACY ON SELECTED MATCHES**
    - We have been stuck at 80% accuracy on categories like Top 10, Top 20, 11-20, Bankers, Value Picks, Upsets, etc.
    - The goal going forward is to move from 80% to **100% consistently**.
    - The goal is NOT to predict all matches accurately. The goal is to predict the matches we **PICK** for these categories with 100% accuracy again and again.
    - **Match Selection is the most important work you will do.** By selecting the right matches, 70% of the work is already done.
    - You must act as an autonomous agent, going through our massive dataset to find out how to improve our prediction software by making tweaks and changes. All buttons/categories must work together to ensure we hit 100% accuracy on selected matches consistently.

    **CRITICAL DEFINITIONS & TERMINOLOGY (DO NOT MIX THESE UP)**:
    1. **PHA (Pattern Historical Analysis)**: 
       - This refers to the **Statistical Probabilities** (Win/Draw/Loss %) derived purely from the historical performance of the specific Sub-Pattern (e.g., "G1r14"). 
       - It is a **Probability**, NOT a prediction code.
       - **PHA Support**: Means the PHA probability for a specific outcome is dominant (e.g., > 50%).
       - **PHA SUPPORT CALCULATION FORMULA**:
         - **PHA Support (Home)** = (Total Home Wins for SubPattern / Total Matches for SubPattern) * 100
         - **PHA Support (Draw)** = (Total Draws for SubPattern / Total Matches for SubPattern) * 100
         - **PHA Support (Away)** = (Total Away Wins for SubPattern / Total Matches for SubPattern) * 100
         - **PHA Support (Double Chance 1X)** = PHA Support (Home) + PHA Support (Draw)
         - **PHA Support (Double Chance X2)** = PHA Support (Draw) + PHA Support (Away)
         - **PHA Support (Double Chance 12)** = PHA Support (Home) + PHA Support (Away)
       - **MANDATORY**: When recommending PHA Support thresholds, you MUST use specific percentages based on this formula (e.g., "PHA Support > 65%"). Do NOT use vague terms like "High Support" or "Strong Support".

    2. **Sub Pattern Prediction**: 
       - This is the **Fixed, Rule-Based Prediction** associated with the Sub-Pattern ID in the codebase (e.g., "G1r14" -> "X2"). 
       - It is a **Hardcoded Rule**, NOT a statistical probability.

    3. **Algo Prediction**: 
       - This is the **Final Weighted Prediction** calculated by the algorithm (incorporating Points, Market Odds, Patterns, Flags, and PHA). 
       - Do NOT call this "PHA Prediction" or "PHA (Algo) prediction". It is the "Algo Prediction".
    
    **MANDATORY**: Every recommendation must explicitly state which Component it applies to:
    - **Daily Live**: For Bankers, Value Bets, Daily Lists.
    - **Jackpot**: For Jackpot Slips and Jackpot Strategy.
    - **General**: For Core Algorithm updates.
    
    **GEMINI INTELLIGENCE INTEGRATION**:
    - You must leverage your vast internal knowledge base, reasoning capabilities, and understanding of advanced statistical modeling, sports analytics, and machine learning principles.
    - Do not just rely on the provided dataset; cross-reference it with your deep understanding of football dynamics, betting markets, and probability theory to ensure recommendations are thoroughly researched and highly accurate.
    
    **OUTPUT FORMAT**:
    Your response must be structured, actionable, and formulaic.
    - **Avoid**: "Consider checking the odds."
    - **Required**: "IF Odds < 1.50 AND PHA < 60% THEN Disqualify."
    - **Avoid**: "Improve the points system."
    - **Required**: "IF League is High Scoring THEN Increase GS Weight by 1.5x."
    
    ${specificPrompt}
    
    INPUT DATA:
    ${strategyContext}
    `;

    return { systemInstruction };
};
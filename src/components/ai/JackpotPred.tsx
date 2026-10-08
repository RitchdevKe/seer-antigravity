
import { Match } from '../../types';
import { matchAlgorithm } from './algorithm';
import { PerformanceMetric, Pick } from './GeminiCards';
import { JACKPOT_CRITERIA } from '../MatchSelector';
import { getMatchEvaluatorTags } from '../../utils/matchEvaluator';
import { getSlipSelectionGuidelines } from './SlipSelection';
import { getMatchSupremeTier, getMatchSupremeTierUnderdog } from '../../utils/seerSupremeTier';

// --- Jackpot Prediction Logic ---

export const generateJackpotPredictionPrompt = (targetMatches: Match[], matchStars: Record<string, number> = {}, slips?: any) => {
    // Build Match JSON for the Auditor Prompt
    const matchPayload = targetMatches.map(m => {
        const prediction = m.algoReport?.prediction || m.rawPrediction || 'NA';
        const rawConfidence = m.algoReport?.confidence || 0;
        const probabilities = m.algoReport?.probabilities || { '1': 0, 'X': 0, '2': 0 };
        const activeFilters = m.algoReport?.activeFilters || [];

        const phaReliability = m.phaReliability ?? matchAlgorithm.getPatternReliability(m.patternAnalysis?.subPattern || null);
        const flags = m.patternAnalysis?.activeFlags || [];
        const qualityAudit = m.qualityAudit ?? matchAlgorithm.evaluateMatchQuality(m);

        // --- DATA INJECTION: PHA STATS ---
        const subP = m.patternAnalysis?.subPattern || 'NA';
        const phaStats = matchAlgorithm.getProbabilities(`S:${subP}`, 0);
        const rawPhaStats = matchAlgorithm.getRawPatternStats(`S:${subP}`);
        const phaSampleSize = rawPhaStats ? rawPhaStats.total : 0;
        
        // Get Match Evaluator Tags (Pre-filtering)
        const phaStatsMap = { [subP]: phaStats };
        let rawTags = (m.evaluatorTags && m.evaluatorTags.length > 0) 
            ? m.evaluatorTags 
            : getMatchEvaluatorTags(m, phaStatsMap, true, true, matchStars); // Pass true for isLiveAnalysisUI to allow hedged tags

        // --- TAG OVERRIDE LOGIC (PRE-PROCESSING) ---
        const hasValuePicks = rawTags.some(t => t.startsWith('value_picks:'));
        const hasBankersJackpot = rawTags.some(t => t.startsWith('bankers_jackpot:'));
        const hasUpsets = rawTags.some(t => t.startsWith('upsets:'));
        const hasBankerDraws = rawTags.some(t => t.startsWith('banker_draws:'));
        const hasValueBets = rawTags.some(t => t.startsWith('value_bets:'));

        let isMandatoryHedge = false;
        if (hasBankerDraws && (hasUpsets || hasBankersJackpot)) {
            isMandatoryHedge = true;
        }

        let basePriority = 0;
        let pStars = 0;
        let promStars = 0;
        let demPenalty = 0;

        const evaluatorTags = rawTags.map(tag => {
            const [cat, pr] = tag.split(':');
            let catAbbr = cat;
            if (cat === 'top10') catAbbr = 'T10';
            else if (cat === 'next_best') catAbbr = 'NB';
            else if (cat === 'top20') catAbbr = 'T20';
            else if (cat === 'bankers_jackpot') catAbbr = 'BNK';
            else if (cat === 'value_bets') catAbbr = 'VB';
            else if (cat === 'value_picks') catAbbr = 'VP';
            else if (cat === 'banker_draws') catAbbr = 'BD';
            else if (cat === 'upsets') catAbbr = 'UPS';
            else if (cat === 'stalemate') catAbbr = 'STL';
            
            const group = m.group || 3;
            const starKey = `${catAbbr}-${pr}-G${group}`;
            const fallbackKey = `${catAbbr}-${pr}-G3`;
            
            let stars = matchStars[starKey];
            if (stars === undefined) {
                stars = matchStars[fallbackKey];
            }

            // Priority Score Calculation
            const prNum = pr ? parseInt(pr.replace('PR', '')) : 0;
            const prVal = prNum > 0 ? (16 - prNum) : 0;
            if (prVal > basePriority) basePriority = prVal;
            if (stars !== undefined) pStars = Math.max(pStars, stars);

            // Check for promote/demote stars specifically
            const promKey = `PROMOTE-${pr}-G${group}`;
            const demKey = `DEMOTE-${pr}-G${group}`;
            promStars = Math.max(promStars, matchStars[promKey] || 0);
            demPenalty = Math.max(demPenalty, matchStars[demKey] || 0);

            return stars !== undefined ? `${tag} (${stars} Stars)` : tag;
        });

        const matchPriorityScore = basePriority + pStars + promStars - demPenalty;

        const moParts = m.mo?.split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(s => !isNaN(s)) || [];
        let marketFav = 'None';
        let drawOdds = 0;
        if (moParts.length >= 3) {
            const minO = Math.min(moParts[0], moParts[2]);
            if (minO === moParts[0]) marketFav = '1';
            else if (minO === moParts[2]) marketFav = '2';
            drawOdds = moParts[1];
        }
        const moUnderdog = marketFav === '1' ? '2' : '1';

        const phaDrawSupport = (phaStats['X'] || 0) * 100;
        const phaUnderdogSupport = (phaStats[moUnderdog as '1'|'2'] || 0) * 100;
        const pointSpread = Math.abs((m.tsa || 0) - (m.tsb || 0));
        
        const algoSupportsUnderdog = m.algoReport?.prediction === moUnderdog || 
                                     m.algoReport?.prediction?.includes(moUnderdog);
        
        const pointSpreadFavorsUnderdog = (moUnderdog === '1' && (m.tsa || 0) > (m.tsb || 0)) ||
                                          (moUnderdog === '2' && (m.tsb || 0) > (m.tsa || 0)) ||
                                          pointSpread <= 5;

        const drivers = [
            `Algo Confidence: ${rawConfidence}%`,
            `SubPattern: ${m.patternAnalysis?.subPattern || 'None'} (${phaReliability})`,
            `Group: ${m.group}`,
            `Flags: ${flags.join(', ') || 'None'}`,
            `TS Differential: ${(m.tsa || 0).toFixed(2)} vs ${(m.tsb || 0).toFixed(2)}`
        ];

        return {
            match_id: m.id,
            teams: m.teams,
            algo_input: {
                prediction: prediction,
                seer_prediction: m.seerPrediction || prediction,
                confidence_score: rawConfidence,
                probabilities: probabilities,
                market_favorite: marketFav,
                drivers: drivers,
                is_locked: false,
                // --- NEW EXPLICIT FIELDS FOR AI CLARITY ---
                sub_pattern: m.patternAnalysis?.subPattern || 'None',
                sub_pattern_rule_prediction: m.patternAnalysis?.subPatternPrediction || 'NA',
                paa_prediction: m.paaPrediction || 'NA',
                paa_primary_prediction: m.paaPrimaryPrediction || 'NA',
                sub_pattern_rating: m.rating || 'NA',
                pha_stats: {
                    '1': phaStats ? Math.round(phaStats['1'] * 100) : 0,
                    'X': phaStats ? Math.round(phaStats['X'] * 100) : 0,
                    '2': phaStats ? Math.round(phaStats['2'] * 100) : 0
                },
                paa_stats: {
                    fav_win_rate: phaStats && phaStats.total > 0 ? Math.round((phaStats.favWin / phaStats.total) * 100) : 0,
                    draw_rate: phaStats && phaStats.total > 0 ? Math.round((phaStats.draw / phaStats.total) * 100) : 0,
                    upset_rate: phaStats && phaStats.total > 0 ? Math.round((phaStats.upsetWin / phaStats.total) * 100) : 0
                },
                pha_sample_size: phaSampleSize,
                match_evaluator_tags: evaluatorTags, // INJECTED PRE-FILTER TAGS
                mandatory_hedge: isMandatoryHedge,
                // --- NEW GUARDRAIL FIELDS ---
                draw_risk_index: {
                    pha_draw_support: phaDrawSupport,
                    point_spread: pointSpread
                },
                draw_trap_data: {
                    has_upset_tag: hasUpsets,
                    market_draw_odds: drawOdds
                },
                stalemate_protocol: {
                    has_banker_and_upset: hasBankersJackpot && hasUpsets
                },
                upset_unhedge_eligible: {
                    pha_underdog_support: phaUnderdogSupport,
                    algo_supports_underdog: algoSupportsUnderdog,
                    point_spread_favors_underdog: pointSpreadFavorsUnderdog
                },
                match_priority_score: matchPriorityScore,
                // --- TRACEABILITY FIELD ---
                tag_trace: rawTags.join(', ')
            },
            context_data: {
                market_odds: m.mo,
                external_prediction: m.pred1x2,
                rating: m.rating,
                points_prediction: m.calculatedPrediction,
                group_volatility: m.group === 3 ? "High" : m.group === 2 ? "Moderate" : "Low"
            },
            quality_audit: qualityAudit,
            supreme_tier_fav: getMatchSupremeTier(m, phaStatsMap),
            supreme_tier_underdog: getMatchSupremeTierUnderdog(m, phaStatsMap)
        };
    });

    // Generate Dynamic Criteria Text with Safe Access
    const safeCriteria = JACKPOT_CRITERIA || [];
    const criteriaSection = safeCriteria.map((c, i) => {
        return `**${c.title.toUpperCase()}**:\n${c.rules.map(r => `- ${r}`).join('\n')}`;
    }).join('\n\n');

    const specificModeInstructions = `
        JACKPOT STRATEGY: SEER SUPREME TIER LOGIC

        **1. THE SEER ALGORITHM PARADIGM**:
        - You must execute the SEER Algorithm logic. You are now the SEER AI Analyst.
        - You will use the SEER Current optimized weightings (Algo Weight, PAA Weight, SubPattern Weight, etc.).
        - Your main task is to discover and apply **Supreme Optimized Weightings** based on the self-learning Supreme Tier models.

        **2. SUPREME TIER CHECKERS (THE NEW SELF LEARNING AI)**:
        - We create "checkers" (insights) and test them against goal accuracy.
        - Insights must be turned into Checkers with an assigned percentage based on Supreme optimized weightings.
        - The more good checkers a match hits (especially those over 75% historical accuracy), the more suitable it is for selection.
        - Example Checkers: "PAA/Algo Agreement", "Synergy Boost A", "Goal Optimization mFAV", "Strong Underdog Alignment".
        
        **3. BANS & EXCLUSIONS**:
        - **Pattern 'R' Ban**: Any match with a main_pattern 'R' or sub_pattern starting with 'R' is entirely BANNED from all categories *except* Upsets. Do not select them.
        - **Group 3 Penalty**: Heavily penalize Group 3 matches for top placements (Top 10, Top 20, Bankers) UNLESS they have >50% on ONE of: 1) Algorithm Probability Confidence, 2) Seer Model Analysis Percentages, or 3) PAA Score. (They are however naturally exempted from this penalty for Banker Draws, Upsets, and Value Bets).

        **4. EVALUATION & SELECTION**:
        - Evaluate each match in the MATCH DATA against the Supreme Tier Checkers.
        - Calculate the "AI-Calculated Confidence" based on the number of >75% accuracy checkers the match successfully passes.
        - DO NOT HALLUCINATE standard hedging rules. Only use the checkers to determine ultimate selection suitability.
    `;

    const systemInstruction = `
        ROLE:
        You are the **SEER Supreme Tier AI Analyst (Gemini 3.8 Flash High Agentic)**. 
        **YOUR PRIMARY DIRECTIVE: ENFORCE SEER ALGORITHM AND SUPREME TIER CHECKERS**

        **EXECUTION SEQUENCE**:
        1. Parse the MATCH DATA and evaluate each match using SEER Supreme Tier check logic.
        2. Identify matches that hit multiple high-accuracy (>75%) Checkers.
        3. Use the SEER Current optimized weightings, but adapt them to improve insights for the Supreme tiers.
        4. Turn all your findings into actionable insights, testing them against goal accuracy to generate your final predictions.
        
        **OUTPUT FORMATTING (STRICT)**:
        - **Prediction**: State the outcome explicitly (1, X, 2, 1X, X2, 12).
        - **Team Name**: Clean name only (e.g., "Arsenal vs Brighton"). No metadata.

        ${specificModeInstructions}
    `;

    let seerSummary = "";
    if (slips) {
        seerSummary = `
        **SEER ENGINE BASELINE SLIPS**:
        The following are selections made by the baseline Seer mathematical engine.
        Use these as candidates to test against your Supreme Tier Checkers.
        
        **SEER PICKS**:
        - **Best Bet**: ${slips.live?.best_bet?.map((p: any) => p.team).join(', ') || 'None'}
        - **Top 10**: ${slips.live?.top_10_value?.map((p: any) => p.team).join(', ') || 'None'}
        - **BOTB**: ${slips.live?.botb_best?.map((p: any) => p.team).join(', ') || 'None'}
        - **Bankers D.live**: ${slips.spec?.bankers_dlive?.map((p: any) => p.team).join(', ') || 'None'}
        - **Bankers Jackpot**: ${slips.spec?.bankers_jackpot?.map((p: any) => p.team).join(', ') || 'None'}
        - **Banker Draws**: ${slips.spec?.banker_draws?.map((p: any) => p.team).join(', ') || 'None'}
        - **Value Picks**: ${slips.spec?.value_picks?.map((p: any) => p.team).join(', ') || 'None'}
        - **Value Bets**: ${slips.spec?.value_bets?.map((p: any) => p.team).join(', ') || 'None'}
        - **Upsets**: ${slips.spec?.upsets?.map((p: any) => p.team).join(', ') || 'None'}
        `;
    }

    const userPrompt = `
        **USER REQUEST**: Optimize these matches using the SEER Supreme Tier analysis.
        
        ${seerSummary}
        
        **MATCH DATA**:
        ${JSON.stringify(matchPayload, null, 2)}
        
        **TASK**:
        1. Test all matches against Supreme Tier Checkers.
        2. Select the matches that check the most Good Checkers (>75% accuracy).
        3. Allocate them into the corresponding slips (Jackpot Predictions, Specialized Analysis slips).
        
        **OUTPUT REQUIREMENT**:
        - Populate 'jackpot_predictions' and 'specialized_analysis' categories in the schema.
        - **AI-Calculated Confidence**: Must reflect the percentage of the Supreme optimized weightings.
        - **Probability**: Raw probability value.
        - **Reason**: Detail which Supreme Checkers were hit.
        
        ${getSlipSelectionGuidelines()}
    `;

    return { systemInstruction, userPrompt };
};

// --- Jackpot Audit Logic ---

export const generateJackpotAuditPrompt = (
    category: string,
    metrics: PerformanceMetric[], 
    failures: Pick[],
    allMatchesSummary: string,
    tacticalAudit?: any,
    taggedMatchesSummary?: string
) => {
    const metricsSummary = metrics.map(m => `${m.category}: ${m.accuracy} (${m.correct}/${m.total})`).join('\n');
    const failuresSummary = failures.slice(0, 15).map(f => 
        `Match: ${f.team} | Pred: ${f.prediction} | Actual: ${f.actualResult} | Odds: ${f.odds} | Reason: ${f.reason} | SubPat: ${f.subPatternPrediction} | Stars: ${f.stars || 0}`
    ).join('\n');

    let tacticalAuditSummary = "No tactical audit available for this category.";
    if (tacticalAudit) {
        tacticalAuditSummary = `
        - Overall: ${tacticalAudit.overall?.accuracy} (${tacticalAudit.overall?.correct}/${tacticalAudit.overall?.total})
        - Slip: ${tacticalAudit.slip?.accuracy} (${tacticalAudit.slip?.correct}/${tacticalAudit.slip?.total})
        - Groups: G1: ${tacticalAudit.groups?.[1]?.accuracy} (${tacticalAudit.groups?.[1]?.correct}/${tacticalAudit.groups?.[1]?.total}), G2: ${tacticalAudit.groups?.[2]?.accuracy} (${tacticalAudit.groups?.[2]?.correct}/${tacticalAudit.groups?.[2]?.total}), G3: ${tacticalAudit.groups?.[3]?.accuracy} (${tacticalAudit.groups?.[3]?.correct}/${tacticalAudit.groups?.[3]?.total})
        - Algo: ${tacticalAudit.algo?.accuracy} (${tacticalAudit.algo?.correct}/${tacticalAudit.algo?.total})
        - Algo Alone: ${tacticalAudit.algoAlone?.accuracy} (${tacticalAudit.algoAlone?.correct}/${tacticalAudit.algoAlone?.total})
        - Algo Alone G1: ${tacticalAudit.algoAloneByGroup?.[1]?.accuracy} (${tacticalAudit.algoAloneByGroup?.[1]?.correct}/${tacticalAudit.algoAloneByGroup?.[1]?.total})
        - Algo Alone G2: ${tacticalAudit.algoAloneByGroup?.[2]?.accuracy} (${tacticalAudit.algoAloneByGroup?.[2]?.correct}/${tacticalAudit.algoAloneByGroup?.[2]?.total})
        - Algo Alone G3: ${tacticalAudit.algoAloneByGroup?.[3]?.accuracy} (${tacticalAudit.algoAloneByGroup?.[3]?.correct}/${tacticalAudit.algoAloneByGroup?.[3]?.total})
        - Algo+PHA: ${tacticalAudit.algoPha?.accuracy} (${tacticalAudit.algoPha?.correct}/${tacticalAudit.algoPha?.total})
        - Algo+PHA+Prob: ${tacticalAudit.algoPhaProb?.accuracy} (${tacticalAudit.algoPhaProb?.correct}/${tacticalAudit.algoPhaProb?.total})
        - Algo+PHA+Ext: ${tacticalAudit.algoPhaExt?.accuracy} (${tacticalAudit.algoPhaExt?.correct}/${tacticalAudit.algoPhaExt?.total})
        - Sub Pattern: ${tacticalAudit.subPatt?.accuracy} (${tacticalAudit.subPatt?.correct}/${tacticalAudit.subPatt?.total})
        - Algo+Sub: ${tacticalAudit.algoSub?.accuracy} (${tacticalAudit.algoSub?.correct}/${tacticalAudit.algoSub?.total})
        - Algo+Sub+PHA: ${tacticalAudit.algoSubPha?.accuracy} (${tacticalAudit.algoSubPha?.correct}/${tacticalAudit.algoSubPha?.total})
        - Priorities:
        ${Object.entries(tacticalAudit.priorities || {}).map(([pr, data]: [string, any]) => 
            `  - ${pr}: Overall ${data.overall?.accuracy} (${data.overall?.correct}/${data.overall?.total}) | G1: ${data.groups?.[1]?.accuracy} (${data.groups?.[1]?.correct}/${data.groups?.[1]?.total}) | G2: ${data.groups?.[2]?.accuracy} (${data.groups?.[2]?.correct}/${data.groups?.[2]?.total}) | G3: ${data.groups?.[3]?.accuracy} (${data.groups?.[3]?.correct}/${data.groups?.[3]?.total})`
        ).join('\n')}
        `;
    }

    const prompt = `
        You are the **Strategic Director** for SEER.AI.
        
        **CONTEXT**: We have completed a performance audit of the Jackpot Predictions for the category: **${category.toUpperCase()}**.
        **GOAL**: Align AI intuition with Algorithmic precision to maximize Jackpot Hits (13/13, 17/17).
        
        **CORRECTNESS FORMULA (HOW WE MEASURE SUCCESS)**:
        - **Top 10 / Top 20**: A match is considered CORRECT if it ended in a **Market Favorite Win or Draw**.
        - **Bankers Jackpot / Value Picks**: A match is considered CORRECT if it ended in a **Market Favorite Win**.
        - **Banker Draws / Value Bets / Upsets**: A match is considered CORRECT if the **AI Prediction** was accurate.
        
        Use this formula to evaluate the failures and recommend adjustments.

        **CRITICAL DEFINITIONS & TERMINOLOGY (DO NOT MIX THESE UP IN YOUR RECOMMENDATIONS)**:
        1. **PHA (Pattern Historical Analysis)**: 
           - This refers to the **Statistical Probabilities** (Win/Draw/Loss %) derived purely from the historical performance of the specific Sub-Pattern (e.g., "G1r14"). 
           - It is a **Probability**, NOT a prediction code.
        
        2. **Sub Pattern Prediction**: 
           - This is the **Fixed, Rule-Based Prediction** associated with the Sub-Pattern ID in the codebase (e.g., "G1r14" -> "X2"). 
           - It is a **Hardcoded Rule**, NOT a statistical probability.

        3. **Algo Prediction**: 
           - This is the **Final Weighted Prediction** calculated by the algorithm (incorporating Points, Market Odds, Patterns, Flags, PHA, and PAA). 
           - Do NOT call this "PHA Prediction" or "PHA (Algo) prediction". It is the "Algo Prediction".

        4. **PAA (Pattern Accuracy Audit)**:
           - This refers to the **Audit of Market Favorites** performance for the pattern.
           - **Fav Win Rate**: How often the favorite won.
           - **Draw Rate**: How often it was a draw.
           - **Upset Rate**: How often the underdog won.
           - Use this to audit the accuracy of the pattern against market bias and identify if a pattern consistently favors favorites or upsets.

        **AI-CALCULATED CONFIDENCE (NEW MANDATE)**:
        - You MUST calculate your own **Match Confidence** (0-100%) for each match in your audit.
        - Combine the Point System, Sub Pattern Prediction, Algo Prediction, PHA, PAA, and Team Strength parity.
        - Use this confidence to explain why certain matches failed and how to improve selection.

        **METRICS DASHBOARD**:
        ${metricsSummary}

        **TACTICAL AUDIT (DETAILED BREAKDOWN)**:
        ${tacticalAuditSummary}
        
        **KEY FAILURES (General)**:
        ${failuresSummary}

        **ALL MATCHES SUMMARY (FOR DRAW AUDIT)**:
        ${allMatchesSummary}
        
        ${taggedMatchesSummary ? `**ALL TAGGED MATCHES (FOR SLIP COMPARISON)**:\n        ${taggedMatchesSummary}` : ''}

        **MANDATORY STRATEGY ROOM REQUIREMENTS**:
        You MUST provide specific analysis and recommendations for THIS SPECIFIC CATEGORY (${category.toUpperCase()}).

        **JACKPOT SLIP CONSTRUCTION (UNHEDGED QUOTA)**:
        - Here is how we need to ensure we improve our accuracy on Jackpot slip.
        - 3 unhedged matches will come form the Bankers Jackpot.
        - Unhedged matches may come from Value Picks if probability > 60%.
        - Opportunistic unhedged matches will come from upsets when massive PHA momentum exists.
        - Unhedged matches may come from Value bets when needed.
        - Banker draws contributes to heged draws.
        - The AI will balance the above to ensure we have 8 matches for a slip of 16 that are unhedged.
        - This will help every category to contribute to the jackpot slip and we will also know which category is performing well on the jackpot slip and which one is failing us.
        - The remaining matches will be hedged. We are really losing on hegded matches which shouldnt be the case, hedged matches should have over 80% accuracy.
        - Algo predictions are currently unreliable and the AI shouldnt force itself to align with them unless its has enough data.

        **NEW PROTOCOLS FOR JACKPOT SLIP**:
        - IF category is 'bankers_jackpot' AND allocated for unhedged quota AND Sub Pattern Prediction is '1X' AND Stars <= 2, THEN Consider hedging.
        - IF selecting the 8 unhedged matches for the Jackpot Slip, THEN select matches based on Priority, PHA, and PAA regardless of their Group (G1, G2, G3).
        - IF Algo Prediction, PHA, and External 1x2 all agree on the match outcome, THEN PROMOTE for the Jackpot Slip unhedged quota.

        **CATEGORY SPECIFIC RULES**:
        - **BANKERS JACKPOTS**: Unhedged Bankers Jackpot selections MUST require a minimum of 3 stars where possible. Be extremely cautious of matches where the Algo completely disagrees with the Sub-Pattern.
        - **VALUE BETS**: IF Category is 'VALUE_BETS' AND Stars >= 4, THEN SELECT for unhedged Jackpot slip. IF Algo Prediction is '1' AND Sub Pattern Prediction is 'X2' (or vice versa), THEN DEMOTE match and ensure mandatory hedge.
        - **BANKER DRAWS**: IF Category is BANKER_DRAWS, THEN prioritize matches based on Priority, PHA, and PAA regardless of their Group. IF Stars are <= 2 AND Sub Pattern Prediction is 1X or X2, THEN PROMOTE for Banker Draws.
        - **UPSETS**: Prioritize PR1 and PR3 matches for the 2 unhedged upset slots on the Jackpot slip based on Priority, PHA, and PAA regardless of their Group.
        *(Note: "PROMOTE" here means prioritizing the match, not necessarily giving it a promote tag.)*

        **1. COMPREHENSIVE EVALUATION**:
           - Look at a one-on-one evaluation of the matches selected for this category and how they performed.
           - Look at all the matches that were selected and how they performed in summary.
           - Look at the different combinations (e.g., All three agree, Agreement with Algo, Agreement with external, Agreement with sub pattern) and learn where to improve.
           - Look at different priorities performance (e.g., PR1, PR2).
           - **CRITICAL: SLIP SELECTION PRIORITIZATION**: Analyze the Tactical Audit to identify the highest performing Priorities and Groups. Recommend exactly which Priorities and Groups should be prioritized for slip selection based on their accuracy. Do NOT force a preference for any group unless the data explicitly shows it is superior.
           - **STARS ANALYSIS**: Audit the matches that had higher stars (e.g., 3, 4, 5) and lost, and those with lower stars (e.g., 0, 1, 2) and won. Provide insights on how best to select matches for the slip based on this star performance.
           - **UPSET MINIMIZATION**: Analyze why upsets occurred. How do we minimize this number? Identify specific data signatures of these upsets.
           - **SELECTION LOGIC AUDIT**: Why were certain matches in the "upset" category selected for the Top 10 slip while accurate matches were left out? You MUST explain this discrepancy and provide a rule to prevent it.

        **2. BETTER SELECTIONS & NON-RANDOM STRATEGIES**:
           - Analyze the 'ALL MATCHES SUMMARY' and the 'ALL TAGGED MATCHES' list (if provided).
           - Try and understand which other matches from the 'ALL TAGGED MATCHES' list would have been a better selection for this category's slip instead of the ones that failed.
           - **SPECIFIC STRATEGY EXAMPLES**:
             - **Demotion Rule**: Demote matches where 'Algo Prediction' is '12' but 'Sub Pattern Prediction' is '1X' or 'X2'.
             - **Contradiction Rule**: Be extremely cautious or DEMOTE matches where the Algo completely disagrees with the Sub-Pattern.
             - **Hedge Caution**: Be cautious with matches where the Sub-Pattern is '12' as these are prone to volatility.
           - On Upsets specifically: The upset algorithm utilizes new explicit boost metrics (PAA Upset support, Prob Underdog, Seer Primary Underdog, Underdog Pattern support). 
             - You MUST evaluate why an Upset tagged match failed. Was it a false positive driven by high PAA but poor base algorithmic support? 
             - You must identify data signatures on when NOT to bet on the underdog even when the match has been listed on the upset list. Identify specific thresholds (like "do not trust unless Seer Primary points to Underdog and PAA Upset > 30%").
             - If you see recurring failures, explicitly recommend adjusting the new "upsetPaaBoost" or "upsetProbBoost" algorithms inside the Deep Learn architect.

        **3. RECOMMENDATIONS (100% ACCURACY GOAL)**:
           - Use this knowledge to recommend changes to ensure that this category achieves 100% accuracy every day.
           - Provide specific, actionable recommendations to improve this category.
           - **DRAW AUDIT**: Check all matches that ended in a DRAW but were NOT detected by 'Banker Draws'. Understand why they were missed and take measures to include them next time, including creating new priorities.
           - **UPSET AUDIT**: Check all matches that ended in an UPSET but were NOT detected by 'Upsets' selection. Understand why they were missed and take measures to include them next time, including creating new priorities.
           - **EXAMPLES OF ACTIONABLE RECOMMENDATIONS**:
             - "Prioritize Group 1 in Top 10 for maximum stability."
             - "DEMOTE Group 1 from PR1 in future predictions if accuracy is < 90%."
             - "Demote PR1 to PR2 and promote PR2 to PR1 if PR2 has higher historical accuracy in this category."
             - "Review the sub pattern rules for [SubPattern] as it consistently triggers upsets."
           - **PRIORITY CREATION RULE**: When recommending new priorities, you MUST check the last existing priority for that category and continue from there. For example, if Upsets currently go up to PR13, your next recommendation MUST be PR14. Do not reuse existing priorities or start from PR1 unless the category has no priorities.

        **OUTPUT FORMAT**:
        - **'adjustments'**: Array of insights. 
          **CONSTRAINT**: Generate **AT LEAST 2 DISTINCT RECOMMENDATIONS** for THIS SPECIFIC CATEGORY (${category.toUpperCase()}).
          Each object must have:
          - 'category': The category name (e.g., "jackpot", "banker_draws", "upsets").
          - 'title': E.g., "Jackpot Value Pick Protocol".
          - 'type': "Risk Management" | "Signal Weighting" | "Strategy Shift" | "Classification Logic" | "Pattern Recognition" | "Selection Priority"
          - 'description': Explanation of the failure and the fix.
          - 'actionable_rule': A specific IF/THEN rule.
          - 'impact': E.g., "Boosts overall accuracy with a huge margin".
        
        - **'detailed_analysis'**: Detailed commentary on the "Value Picks" importance and the failure to identify "Banker Draws" and "Upsets", and your analysis of ALL matches that ended in a draw.
    `;
    return prompt;
};

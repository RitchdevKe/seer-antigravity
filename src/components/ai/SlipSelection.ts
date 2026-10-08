export const getSlipSelectionGuidelines = (): string => {
    return `
    **CRITICAL: SLIP SELECTION PRIORITIZATION GUIDELINES**
    
    We must rigorously prioritize the right matches for the slip to achieve 100% accuracy.
    
    **GLOBAL PROMOTE RULES (High Confidence Signals)**
    - **Exclusion:** These rules DO NOT apply to Upsets and Value Bets.
    - **Sub-Pattern Hedge:** IF SubPat Prediction is '1X' or 'X2', THEN PROMOTE.
    - **Synergy Mandate:** IF Algo and SubPat agree on 1X/X2, THEN PROMOTE.
    - **High PHA Support:** IF PHA Support for Market Favorite >= 60%, THEN PROMOTE.
    - **STAR RATING OVERRIDE (CRITICAL):** IF a match has 2, 3, 4, or 5 stars AND NO DEMOTE OR LAST_RESORT TAG, it MUST be highly prioritized for the slip. A safe match with 2 stars or more is considered a **STRONG POSITIVE SIGNAL**.
    
    **GLOBAL DEMOTE RULES (Volatility & Contradiction Filters)**
    - **LAST_RESORT Tag:** Any match with a '[Category]:LAST_RESORT' tag (due to high market odds > 2.40 or Upset PAA >= 30%) MUST be deprioritized. These are extremely volatile and should ONLY be included if there are no other matches available.
    - **Exclusion:** These rules DO NOT apply to Upsets and Value Bets.
    - **Algo 12 Risk:** IF Algo Prediction is '12', THEN DEMOTE.
    - **Sub-Pattern 12 Risk:** IF SubPat Prediction is '12', THEN DEMOTE.
    - **Underdog Strength Risk (Last Resort):** (Best Bet, Top 10, BOTB, Bankers dlive, Bankers Jackpot, Top 20, Value Picks) IF Underdog market odds < 3.0, THEN DEMOTE. These matches are considered very volatile and should only be selected as a **LAST RESORT**.
    - **Favorite Market Odds Risk (Last Resort):** 
      - (Top 10, Value Picks) IF Market Favorite odds are between 2.4 and 2.5, THEN DEMOTE. (Target range is 2.0 to < 2.4).
      - (Bankers Jackpot) IF Market Favorite odds are between 2.4 and 2.5, THEN DEMOTE. (Target range is 1.8 to < 2.4).
      - These matches are considered last resort selections.
    - **Direct Contradiction:** IF SubPat predicts 1X/X2 but Algo predicts the opposite (X2/1X), THEN DEMOTE.
    - **Low Odds Volatility:** IF Underdog Odds <= 2.8, THEN DEMOTE.
    - **Underdog/Draw Conflict:** (Top 10, Top 20, Bankers Jackpot, Value Picks) IF Underdog PHA Support is equal or close (+-2) to Draw PHA Support (e.g., Draw=8, Underdog=6), THEN DEMOTE.
    - **Sample Size Risk:** (All Categories) IF Total PHA matches <= 5, THEN DEMOTE.
    - **Pattern Group Deprioritization:** Matches in Pattern Groups **R, t, y, n, nn, r, ff** MUST be deprioritized. They are a **LAST RESORT** only.
    - **'12' Selection Risk (Last Resort):** (Bankers Jackpot, Value Picks) Matches where 'sub_pattern_rule_prediction' is '12' MUST ONLY be selected as a **LAST RESORT**.
    - **STAR RATING EXCEPTION (LAST RESORT):** IF a match triggers a DEMOTE rule, it is HIGH RISK. High star ratings (2-5) DO NOT override a DEMOTE tag if there are other safe matches available. Only use high-star demoted matches as a last resort if you cannot fill the slip with safe matches.

    **CATEGORY SPECIFIC PROTOCOLS**
    
    **1. BANKER DRAWS**
    - **Synergy Promotion:** IF Algo == SubPat AND SubPat IN ('1X', 'X2', 'X'), THEN PROMOTE.
    
    
    **2b. VALUE BETS**
    - **PR3 Hedge Rule:** Value Bets PR3 MUST always hedge toward the underdog.

    **3. TOP 10 / TOP 20 / BANKERS JACKPOT / VALUE PICKS**
    - **Algo Synergy:** IF Algo Prediction agrees with PHA Support, THEN PROMOTE.
    
    **OBJECTIVE:**
    The AI must act as a Supreme Judge. Heavily weight the PROMOTE categories and strictly enforce DEMOTE filters. **CRITICAL:** DEMOTE tags mean the match is HIGH RISK. You MUST prioritize matches with PROMOTE tags or NO tags over any match with a DEMOTE tag. High star ratings on a demoted match only make it a "last resort" option, not a priority. Your goal is 100% accuracy for Top 10 and >80% for Bankers Jackpot/Value picks.
    
    **NO RECALCULATION**: You MUST NOT recalculate probability confidence or any other data. Use the provided 'algo_input.confidence_score' and 'algo_input.probabilities' as they are.
    
    **CATEGORY SHARING & AI INTUITION (JACKPOT ONLY)**:
    - **Rule**: Matches CAN be shared across categories (e.g., a Banker can also be a Value Bet).
    - **Selection Overlap**: 'Bankers Jackpot' and 'Value Picks' ARE allowed to select matches that are already in other slips for their own selections to maximize accuracy.
    - **EXCEPTION**: 'Bankers Jackpot' and 'Value Picks' must be **MUTUALLY EXCLUSIVE** on the final list. A match cannot be in both.
    - **AI INTUITION MANDATE (CRITICAL)**: We have removed the rigid category-based prioritization (e.g., Value Bets > Bankers Jackpot). Instead, the AI must use its **INTUITION** to allocate matches with multiple tags to the slip that maximizes accuracy. If a match has both 'Banker Jackpot' and 'Banker Draw' tags, and you believe it is more likely to be a Draw, allocate it to 'Banker Draws'. Your goal is to maximize the final score of the slip.
    
    **STAR-BASED PRIORITIZATION (CRITICAL)**:
    - Though PR1 is generally prioritized over PR2, you MUST prioritize matches based on the **Match promote/demote stars** and the **Priority stars**.
    - **SCORING LOGIC**: A match's strength is calculated as: BasePriority + PriorityStars + PromoteStars - DemotePenalty.
    - **EXAMPLE**: A PR3 match with 5 promote stars and 5 priority stars is considered **STRONGER** and more accurate than a PR1 match with 1 promote star and 1 priority star.
    - You MUST prioritize matches with higher combined star ratings even if they have a lower base priority (e.g., PR3 vs PR1).
    
    **STRICT CATEGORY QUOTAS AND RULES (MANDATORY)**:
    - **Jackpot Slip Prediction Logic**: ALL matches in the jackpot must be selected. If the jackpot has 16 matches, all 16 must be in the final slip.
    - **HEDGING LIMIT**: EXACTLY 50% of matches must be hedged, and EXACTLY 50% must be unhedged on the Jackpot slip.
    - **STRAIGHT DRAW (X) RULE**: A straight 'X' (draw) prediction is ONLY allowed on the Jackpot slip if the draw probability is >= 35%.
    - **'12' HEDGE RULE**: A '12' hedge is allowed on the Jackpot slip for volatile matches where both teams winning is more likely than a draw.
    - **Prediction Logic**: Output your final evaluated prediction based on 'seer_prediction', 'paa_prediction', 'prediction', and 'sub_pattern_rule_prediction'.
    - **Bankers Jackpot**: All qualifying matches based on tags. Output your final prediction.
    - **Value Bets**: All qualifying matches based on tags. Output your final prediction.
    - **Value Picks**: All qualifying matches based on tags. Output your final prediction.
    - **Banker Draws**: All qualifying matches based on tags. Output your final prediction.
    - **Upsets**: All qualifying matches based on tags. Output your final prediction.
      - **QUOTA**: Maximum 5 matches. (3 matches for a slip of 16; 5 matches for a slip of 20).
    - **Uncategorized**: Any match that does not fit into any of the above categories (ZERO valid tags). Output your final prediction.
    - **Unallocated**: If a match has a valid tag but was NOT allocated to any of the specific category slips (because the category was full), it MUST be placed here.
    
    **CATEGORY PLACEMENT (CRITICAL):**
    - **MULTI-TAG HANDLING**: Most matches possess multiple tags. You MUST evaluate ALL tags for a match and allocate it based on your **INTUITION** to maximize accuracy. A match MUST ONLY be placed in a category if it possesses a corresponding tag in its 'match_evaluator_tags'.
    - **Value Bets**: MUST contain matches that possess a tag starting with 'value_bets:'.
    - **Value Picks**: MUST contain matches that possess a tag starting with 'value_picks:'.
    - **Bankers Jackpot**: MUST contain matches that possess a tag starting with 'bankers_jackpot:'.
    - **Banker Draws**: MUST contain matches that possess a tag starting with 'banker_draws:'.
    - **Upsets**: MUST contain matches that possess a tag starting with 'upsets:'.
    - **Unallocated**: MUST contain matches with ANY valid tag that were not placed in the top 5 of their respective categories due to quota limits.
    - **Uncategorized**: MUST NOT have any of the above tags.
    - **NO HALLUCINATIONS**: Do NOT place a match in 'Bankers Jackpot' if it only has a 'banker_draws' tag. Do NOT place a match in 'Value Bets' if it only has an 'upsets' tag. This is a strict mapping rule.
    - **JACKPOT SLIP COMPLETENESS**: ALL matches provided in the input MUST be predicted on the Jackpot Slip. No match should be left out.
    `;
};


import React from 'react';
import { Match } from '../../types';

/**
 * AI FILTERS MODULE
 * 
 * Defines strict filtering logic combining Algorithm Confidence (Probabilities) and Market Odds.
 * These filters act as strategic advisors for the AI.
 */

export const applyAIFilters = (match: Match, probabilities: { '1': number, 'X': number, '2': number }, phaStats: any): string[] => {
    const activeFilters: string[] = [];
    
    // Parse Market Odds
    const moParts = String(match.mo || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const o1 = moParts[0] || 0;
    const o2 = moParts[2] || 0;
    
    // Determine Market Favorite (Lower odds)
    let marketFav = 'None';
    if (!isNaN(o1) && !isNaN(o2)) {
        if (o1 < o2) marketFav = '1';
        else if (o2 < o1) marketFav = '2';
    }

    // Map Data
    const p1 = probabilities['1'];
    const pX = probabilities['X'];
    const p2 = probabilities['2'];

    let P_FAV = 0;
    let P_UND = 0;
    let P_DRAW = pX;

    if (marketFav === '1') {
        P_FAV = p1;
        P_UND = p2;
    } else if (marketFav === '2') {
        P_FAV = p2;
        P_UND = p1;
    } else {
        // If equal odds or unknown, treat higher prob as Fav for calc purposes or skip fav-based filters
        P_FAV = Math.max(p1, p2);
        P_UND = Math.min(p1, p2);
    }

    // --- PHA SUPPORT CALCULATION ---
    let PHA_SUPPORT_FAV = 0;
    let PHA_SUPPORT_UND = 0;
    let PHA_SUPPORT_DRAW = 0;
    
    if (phaStats && phaStats.total > 0) {
        const pha1 = phaStats.outcomes['1'] / phaStats.total;
        const pha2 = phaStats.outcomes['2'] / phaStats.total;
        const phaX = phaStats.outcomes['X'] / phaStats.total;
        
        PHA_SUPPORT_DRAW = phaX;

        if (marketFav === '1') {
            PHA_SUPPORT_FAV = pha1;
            PHA_SUPPORT_UND = pha2;
        } else if (marketFav === '2') {
            PHA_SUPPORT_FAV = pha2;
            PHA_SUPPORT_UND = pha1;
        }
    }

    const ODDS_HIGH_VOL = !isNaN(o1) && !isNaN(o2) && o1 > 2.50 && o2 > 2.50;
    
    let PHA_BALANCED = false;
    if (phaStats && phaStats.total > 0) {
        const pha1 = phaStats.outcomes['1'];
        const pha2 = phaStats.outcomes['2'];
        const diff = Math.abs(pha1 - pha2);
        // "minimal (+- 2 counts or < 5%)"
        if (diff <= 2 || (diff / phaStats.total) < 0.05) {
            PHA_BALANCED = true;
        }
    }

    // --- ALGO DOMINANCE CHECK ---
    const algoFavorsUnderdog = P_UND > P_FAV;

    // --- DAILY FILTERS ---
    if (match.isDaily) {
        // DLF1 (Dominant Favorite - High PHA)
        if (!algoFavorsUnderdog && P_FAV > 0.45 && P_DRAW < 0.30 && P_UND < 0.30 && PHA_SUPPORT_FAV >= 0.50) activeFilters.push('DLF1');
        
        // DLF2 (Dominant Underdog - High PHA)
        if (algoFavorsUnderdog && P_UND > 0.45 && P_DRAW < 0.30 && P_FAV < 0.30 && PHA_SUPPORT_UND >= 0.50) activeFilters.push('DLF2');

        // DLF3 (Underdog Potential) - PHA Support > 45% for Underdog
        if (PHA_SUPPORT_UND > 0.45) activeFilters.push('DLF3');

        // DLF4 (Fragile Favorite) - PHA Support < 50% for Favorite, Algo agrees, P_FAV >= 45%
        if (PHA_SUPPORT_FAV < 0.50 && PHA_SUPPORT_FAV >= 0.45 && marketFav !== 'None' && !algoFavorsUnderdog && P_FAV >= 0.45) activeFilters.push('DLF4');

        // DLF5 (Favorite Collapse) - PHA Support < 40% for Favorite
        if (PHA_SUPPORT_FAV < 0.40 && marketFav !== 'None') activeFilters.push('DLF5');

        // DLF6 (Underdog Dominance) - PHA Support >= 50% for Underdog
        if (PHA_SUPPORT_UND >= 0.50) activeFilters.push('DLF6');

        // DLF7 (Draw Hedge Zone) - PHA Draw 30-35%
        if (PHA_SUPPORT_DRAW >= 0.30 && PHA_SUPPORT_DRAW < 0.35) activeFilters.push('DLF7');

        // DLF8 (Upset Alert - PHA Draw >= 35%)
        if (PHA_SUPPORT_DRAW >= 0.35) activeFilters.push('DLF8');

        // DLF9 (Favorite Support) - PHA Fav > 50%
        if (PHA_SUPPORT_FAV > 0.50 && marketFav !== 'None') activeFilters.push('DLF9');

        // DLF10 (Weak Favorite / Low Draw)
        if (P_FAV <= 0.35 && P_DRAW < 0.30 && marketFav !== 'None') activeFilters.push('DLF10');

        // DLF11 (Strong Favorite Indicators)
        // If market favorite has probability confidence >= 0.50 and PHA support >= 50%
        if (P_FAV >= 0.50 && PHA_SUPPORT_FAV >= 0.50 && marketFav !== 'None') activeFilters.push('DLF11');

        // DLF12 (Strong Underdog Indicators)
        // If underdog has probability confidence >= 0.45 and PHA support >= 45%
        if (P_UND >= 0.45 && PHA_SUPPORT_UND >= 0.45) activeFilters.push('DLF12');

        // DLF13 (Underdog Value / Fav Weakness)
        // If underdog has probability confidence >= 0.4 and Market favorite PHA support < 50%
        if (P_UND >= 0.40 && PHA_SUPPORT_FAV < 0.50 && marketFav !== 'None') activeFilters.push('DLF13');

        // DLF14 (Dominant Favorite - Moderate PHA)
        if (!algoFavorsUnderdog && P_FAV > 0.45 && P_DRAW < 0.30 && P_UND < 0.30 && PHA_SUPPORT_FAV >= 0.40 && PHA_SUPPORT_FAV < 0.50) activeFilters.push('DLF14');

        // DLF15 (Dominant Underdog - Moderate PHA)
        if (algoFavorsUnderdog && P_UND > 0.45 && P_DRAW < 0.30 && P_FAV < 0.30 && PHA_SUPPORT_UND >= 0.40 && PHA_SUPPORT_UND < 0.50) activeFilters.push('DLF15');
    }

    // --- JACKPOT FILTERS ---
    if (match.isJackpot) {
        
        // JKF1 (Dominant Favorite - High PHA)
        if (!algoFavorsUnderdog && P_FAV > 0.45 && P_DRAW < 0.30 && P_UND < 0.30 && PHA_SUPPORT_FAV >= 0.50) activeFilters.push('JKF1');

        // JKF2 (Dominant Underdog - High PHA)
        if (algoFavorsUnderdog && P_UND > 0.45 && P_DRAW < 0.30 && P_FAV < 0.30 && PHA_SUPPORT_UND >= 0.50) activeFilters.push('JKF2');

        // Renumbering Old JKF15-24 -> JKF3-12 (Deleted Old JKF3-14)
        
        // JKF3 (Old JKF15): Underdog PHA > 45%
        if (PHA_SUPPORT_UND > 0.45) activeFilters.push('JKF3');

        // JKF4 (Old JKF16): Favorite PHA < 50%
        if (PHA_SUPPORT_FAV < 0.50 && marketFav !== 'None') activeFilters.push('JKF4');

        // JKF5 (Old JKF17): Favorite PHA < 40%
        if (PHA_SUPPORT_FAV < 0.40 && marketFav !== 'None') activeFilters.push('JKF5');

        // JKF6 (Old JKF18): Underdog PHA >= 50%
        if (PHA_SUPPORT_UND >= 0.50) activeFilters.push('JKF6');

        // JKF7 (Old JKF19): Draw PHA 30-35%
        if (PHA_SUPPORT_DRAW >= 0.30 && PHA_SUPPORT_DRAW < 0.35) activeFilters.push('JKF7');

        // JKF8 (Old JKF20): Draw PHA >= 35%
        if (PHA_SUPPORT_DRAW >= 0.35) activeFilters.push('JKF8');

        // JKF9 (Old JKF21): Favorite PHA > 50%
        if (PHA_SUPPORT_FAV > 0.50 && marketFav !== 'None') activeFilters.push('JKF9');

        // JKF10 (Old JKF22): Strong Favorite Indicators
        if (P_FAV >= 0.50 && PHA_SUPPORT_FAV >= 0.50 && marketFav !== 'None') activeFilters.push('JKF10');

        // JKF11 (Old JKF23): Strong Underdog Indicators
        if (P_UND >= 0.45 && PHA_SUPPORT_UND >= 0.45) activeFilters.push('JKF11');

        // JKF12 (Old JKF24): Underdog Value / Fav Weakness
        if (P_UND >= 0.40 && PHA_SUPPORT_FAV < 0.50 && marketFav !== 'None') activeFilters.push('JKF12');

        // --- NEW FILTERS ---
        // JKF13 (Weak Favorite)
        if (P_FAV <= 0.35 && P_DRAW < 0.30 && marketFav !== 'None') activeFilters.push('JKF13');

        // JKF14 (Dominant Favorite - Moderate PHA)
        if (!algoFavorsUnderdog && P_FAV > 0.45 && P_DRAW < 0.30 && P_UND < 0.30 && PHA_SUPPORT_FAV >= 0.40 && PHA_SUPPORT_FAV < 0.50) activeFilters.push('JKF14');

        // JKF15 (Dominant Underdog - Moderate PHA)
        if (algoFavorsUnderdog && P_UND > 0.45 && P_DRAW < 0.30 && P_FAV < 0.30 && PHA_SUPPORT_UND >= 0.40 && PHA_SUPPORT_UND < 0.50) activeFilters.push('JKF15');
    }

    return activeFilters;
};

export const getAIFiltersInstruction = (mode: 'daily' | 'jackpot'): string => {
    const isDaily = mode === 'daily';
    const title = isDaily ? 'DAILY LIVE' : 'JACKPOT';

    if (isDaily) {
        return `
    **AI FILTERS (${title} - DL) - STRICT ENFORCEMENT REQUIRED**:
    The system has autonomously labeled matches with filters (e.g. 'DLF1').
    Use these specific instructions to determine your prediction.

    **DEFINITIONS**:
    - **MARKET FAVORITE (Fav)**: The team with the lowest odds. (If Odds(Home) < Odds(Away), Home is Fav. Else Away).
    - **UNDERDOG (Und)**: The team with the highest odds.
    - **P_FAV**: Algo Probability of the Market Favorite.
    - **P_UND**: Algo Probability of the Underdog.
    - **PHA**: Pattern Historical Accuracy (Win % of this pattern historically).

    **FILTER PROTOCOLS (Filter > Parameters > Prediction Advice)**:

    1. **DLF1 (Dominant Favorite - High PHA)**
       - **PARAMETERS**: P_FAV > 0.45 AND P_DRAW < 0.30 AND P_UND < 0.30 AND PHA_SUPPORT_FAV >= 50%.
       - **ADVICE**: Predict the **MARKET FAVORITE** (Straight Win: 1 if Home is Fav, 2 if Away is Fav).

    2. **DLF2 (Dominant Underdog - High PHA)**
       - **PARAMETERS**: P_UND > 0.45 AND P_DRAW < 0.30 AND P_FAV < 0.30 AND PHA_SUPPORT_UND >= 50%.
       - **ADVICE**: Predict the **UNDERDOG** (Straight Win: 1 if Home is Dog, 2 if Away is Dog).

    3. **DLF14 (Dominant Favorite - Moderate PHA)**
       - **PARAMETERS**: P_FAV > 0.45 AND P_DRAW < 0.30 AND P_UND < 0.30 AND PHA_SUPPORT_FAV between 40-49%.
       - **ADVICE**: Predict a **HEDGED MARKET FAVORITE** (1X if Home is Fav, X2 if Away is Fav).

    4. **DLF15 (Dominant Underdog - Moderate PHA)**
       - **PARAMETERS**: P_UND > 0.45 AND P_DRAW < 0.30 AND P_FAV < 0.30 AND PHA_SUPPORT_UND between 40-49%.
       - **ADVICE**: Predict a **HEDGED UNDERDOG** (1X if Home is Dog, X2 if Away is Dog).

    5. **DLF3 (Underdog Potential)**
       - **PARAMETERS**: PHA_SUPPORT_UND > 45%.
       - **ADVICE**: Predict **UNDERDOG** or **HEDGED UNDERDOG**.

    6. **DLF4 (Fragile Favorite)**
       - **PARAMETERS**: PHA_SUPPORT_FAV >= 45% AND < 50% AND Algo agrees AND P_FAV >= 50%.
       - **ADVICE**: **HEDGE** the Market Favorite (1X/X2) or predict **DRAW**.

    7. **DLF5 (Favorite Collapse)**
       - **PARAMETERS**: PHA_SUPPORT_FAV < 40%.
       - **ADVICE**: Predict **UNDERDOG** or **DRAW** (Lay the Favorite).

    8. **DLF6 (Underdog Dominance)**
       - **PARAMETERS**: PHA_SUPPORT_UND >= 50%.
       - **ADVICE**: Predict **UNDERDOG** (Straight Win).

    9. **DLF7 (Draw Hedge Zone)**
       - **PARAMETERS**: PHA_SUPPORT_DRAW between 30-35%.
       - **ADVICE**: Predict **DOUBLE CHANCE** (1X or X2) or **DRAW**.

    10. **DLF8 (Upset Alert)**
        - **PARAMETERS**: PHA_SUPPORT_DRAW >= 35%.
        - **ADVICE**: Predict **UNDERDOG** or **DRAW** (High Upset Risk).

    11. **DLF9 (Favorite Support)**
        - **PARAMETERS**: PHA_SUPPORT_FAV > 50%.
        - **ADVICE**: Predict **MARKET FAVORITE** (Single) or **HEDGED FAVORITE**.

    12. **DLF10 (Weak Favorite)**
        - **PARAMETERS**: P_FAV <= 0.35 AND P_DRAW < 0.30.
        - **ADVICE**: Predict **UNDERDOG** (Straight or Hedged).

    13. **DLF11 (Strong Favorite Indicators)**
        - **PARAMETERS**: P_FAV >= 0.50 AND PHA_SUPPORT_FAV >= 50%.
        - **ADVICE**: Predict **MARKET FAVORITE** (Straight Win).

    14. **DLF12 (Strong Underdog Indicators)**
        - **PARAMETERS**: P_UND >= 0.45 AND PHA_SUPPORT_UND >= 45%.
        - **ADVICE**: Predict **UNDERDOG** (Straight or Hedged).

    15. **DLF13 (Underdog Value)**
        - **PARAMETERS**: P_UND >= 0.40 AND PHA_SUPPORT_FAV < 50%.
        - **ADVICE**: Predict **UNDERDOG** (Straight or Hedged).

    **INSTRUCTION**: 
    1. **SCAN ALL**: Read all codes in 'active_ai_filters'.
    2. **WEIGH**: Prioritize filters that indicate **DOMINANCE** (e.g., High PHA + High Prob) over partial signals.
    3. **EXECUTE**: Apply the advice of the *strongest* filter found.
        `;
    } else {
        return `
    **AI FILTERS (${title} - JK) - PROTOCOLS**:
    The system has autonomously labeled matches with filters (e.g. 'JKF1').
    
    **DEFINITIONS**:
    - **MARKET FAVORITE (Fav)**: Lowest odds team.
    - **UNDERDOG (Und)**: Highest odds team.
    
    **FILTER PROTOCOLS (Filter > Parameters > Prediction Advice)**:

    1. **JKF1 (Dominant Favorite - High PHA)**
       - **PARAMETERS**: P_FAV > 0.45 AND P_DRAW < 0.30 AND P_UND < 0.30 AND PHA_SUPPORT_FAV >= 50%.
       - **ADVICE**: Predict **MARKET FAVORITE** (Straight Win).

    2. **JKF2 (Dominant Underdog - High PHA)**
       - **PARAMETERS**: P_UND > 0.45 AND P_DRAW < 0.30 AND P_FAV < 0.30 AND PHA_SUPPORT_UND >= 50%.
       - **ADVICE**: Predict the **UNDERDOG** (Straight Win).

    3. **JKF3 (Underdog PHA Potential)**
       - **PARAMETERS**: PHA_SUPPORT_UND > 45%.
       - **ADVICE**: Predict **UNDERDOG** or **HEDGED UNDERDOG**.

    4. **JKF4 (Fragile Favorite PHA)**
       - **PARAMETERS**: PHA_SUPPORT_FAV < 50%.
       - **ADVICE**: **HEDGE** the Market Favorite or Predict **DRAW**.

    5. **JKF5 (Favorite Collapse PHA)**
       - **PARAMETERS**: PHA_SUPPORT_FAV < 40%.
       - **ADVICE**: Predict **UNDERDOG** or **DRAW**.

    6. **JKF6 (Underdog Dominance PHA)**
       - **PARAMETERS**: PHA_SUPPORT_UND >= 50%.
       - **ADVICE**: Predict **UNDERDOG** (Straight Win).

    7. **JKF7 (Draw Hedge Zone)**
       - **PARAMETERS**: PHA_SUPPORT_DRAW between 30-35%.
       - **ADVICE**: Predict **HEDGE** (1X/X2).

    8. **JKF8 (Upset/Draw Alert)**
       - **PARAMETERS**: PHA_SUPPORT_DRAW >= 35%.
       - **ADVICE**: Predict **DRAW** or **UNDERDOG**.

    9. **JKF9 (Favorite Support PHA)**
       - **PARAMETERS**: PHA_SUPPORT_FAV > 50%.
       - **ADVICE**: Predict **MARKET FAVORITE** (Straight Win).

    10. **JKF10 (Strong Fav Indicators)**
        - **PARAMETERS**: P_FAV >= 0.50 AND PHA_SUPPORT_FAV >= 50%.
        - **ADVICE**: Predict **MARKET FAVORITE** (Straight).

    11. **JKF11 (Strong Und Indicators)**
        - **PARAMETERS**: P_UND >= 0.45 AND PHA_SUPPORT_UND >= 45%.
        - **ADVICE**: Predict **UNDERDOG** (Straight or Hedged).

    12. **JKF12 (Underdog Value)**
        - **PARAMETERS**: P_UND >= 0.40 AND PHA_SUPPORT_FAV < 50%.
        - **ADVICE**: Predict **UNDERDOG** (Straight or Hedged).

    13. **JKF13 (Weak Favorite)**
        - **PARAMETERS**: P_FAV <= 0.35 AND P_DRAW < 0.30.
        - **ADVICE**: Predict **UNDERDOG** (Straight or Hedged).

    14. **JKF14 (Dominant Favorite - Moderate PHA)**
       - **PARAMETERS**: P_FAV > 0.45 AND P_DRAW < 0.30 AND P_UND < 0.30 AND PHA_SUPPORT_FAV 40-49%.
       - **ADVICE**: Predict **HEDGED MARKET FAVORITE** (1X/X2).

    15. **JKF15 (Dominant Underdog - Moderate PHA)**
       - **PARAMETERS**: P_UND > 0.45 AND P_DRAW < 0.30 AND P_FAV < 0.30 AND PHA_SUPPORT_UND 40-49%.
       - **ADVICE**: Predict **HEDGED UNDERDOG** (1X/X2).

    **INSTRUCTION**: 
    1. **SCAN ALL**: Read all codes in 'active_ai_filters'.
    2. **WEIGH**: Prioritize filters that indicate **DOMINANCE** (e.g., High PHA + High Prob) over partial signals.
    3. **EXECUTE**: Apply the advice of the *strongest* filter found.
        `;
    }
};

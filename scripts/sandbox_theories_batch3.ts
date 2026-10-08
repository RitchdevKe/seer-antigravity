import fs from 'fs';
import path from 'path';

function runTests() {
    const matchesPath = path.join(process.cwd(), 'supabase_backup/user_uploaded_matches.json');
    const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));

    let validMatches = 0;

    // Result tracking
    const t1 = { total: 0, fav: 0, draw: 0, und: 0 };
    const t2 = { total: 0, fav: 0, draw: 0, und: 0 };
    
    // Theory 4 - 3 Predictors (All)
    const t4_3_40 = { total: 0, fav: 0, draw: 0, und: 0 };
    const t4_3_45 = { total: 0, fav: 0, draw: 0, und: 0 };
    const t4_3_50 = { total: 0, fav: 0, draw: 0, und: 0 };

    // Theory 4 - 2 Predictors
    const t4_2_40 = { total: 0, fav: 0, draw: 0, und: 0, combos: {} as Record<string, any> };
    const t4_2_45 = { total: 0, fav: 0, draw: 0, und: 0, combos: {} as Record<string, any> };
    const t4_2_50 = { total: 0, fav: 0, draw: 0, und: 0, combos: {} as Record<string, any> };


    for (let rawMatch of matches) {
        const match = rawMatch.data ? { ...rawMatch.data, ...rawMatch } : rawMatch;
        match.odds = match.odds || match.mo;

        if (!match.result || !match.odds) continue;
        
        const odds = typeof match.odds === 'string' ? match.odds.split(/[,|]/) : match.odds;
        if (!odds || odds.length < 3) continue;
        
        const hOdds = parseFloat(odds[0]);
        const dOdds = parseFloat(odds[1]);
        const aOdds = parseFloat(odds[2]);
        if (isNaN(hOdds) || isNaN(dOdds) || isNaN(aOdds)) continue;
        
        // Favorite is strictly between Home and Away
        const isFavHome = hOdds <= aOdds;
        const favOdds = isFavHome ? hOdds : aOdds;
        const undOdds = isFavHome ? aOdds : hOdds;
        
        const res = match.result.split(':');
        if (res.length !== 2) continue;
        
        const homeGoals = parseInt(res[0]);
        const awayGoals = parseInt(res[1]);
        if (isNaN(homeGoals) || isNaN(awayGoals)) continue;
        
        validMatches++;

        let outcome = 'X';
        if (homeGoals > awayGoals) outcome = '1';
        if (awayGoals > homeGoals) outcome = '2';
        
        const favWinStr = isFavHome ? '1' : '2';
        const undWinStr = isFavHome ? '2' : '1';
        
        let isDraw = outcome === 'X';
        let isFav = outcome === favWinStr;
        let isUnd = outcome === undWinStr;

        // Data extraction
        const paaDraw = match.paaDraw || 0;
        const seerDraw = match.seerPercentages ? match.seerPercentages['X'] : 0;
        const algoDrawRaw = match.algoReport?.probabilities?.['X'] || 0;
        const algoDraw = algoDrawRaw <= 1 ? algoDrawRaw * 100 : algoDrawRaw;

        const paaFav = isFavHome ? (match.paaWin||0) : (match.paaUpset||0);
        const paaUnd = isFavHome ? (match.paaUpset||0) : (match.paaWin||0);
        const seerFav = match.seerPercentages ? (isFavHome ? match.seerPercentages['1'] : match.seerPercentages['2']) : 0;
        const seerUnd = match.seerPercentages ? (isFavHome ? match.seerPercentages['2'] : match.seerPercentages['1']) : 0;
        
        const algoP1 = match.algoReport?.probabilities?.['1'] || 0;
        const algoP2 = match.algoReport?.probabilities?.['2'] || 0;
        const algoFav = (algoP1 <= 1 ? algoP1 * 100 : algoP1) === 0 ? 0 : (isFavHome ? algoP1 : algoP2) * (algoP1 <= 1 ? 100 : 1);
        const algoUnd = (algoP2 <= 1 ? algoP2 * 100 : algoP2) === 0 ? 0 : (isFavHome ? algoP2 : algoP1) * (algoP2 <= 1 ? 100 : 1);

        // --- Theory 1: Fragile Favorite (Odds >= 2.0 AND all draws > 30) ---
        if (favOdds >= 2.0 && algoDraw > 30 && paaDraw > 30 && seerDraw > 30) {
            t1.total++;
            if (isFav) t1.fav++;
            if (isDraw) t1.draw++;
            if (isUnd) t1.und++;
        }

        // --- Theory 2: Underdog Momentum + ML Support ---
        const tsa = match.tsa || 0;
        const tsb = match.tsb || 0;
        const favTs = isFavHome ? tsa : tsb;
        const undTs = isFavHome ? tsb : tsa;
        const tsSupportsUnderdog = undTs > favTs;

        const gsHome = match.gsHome || 0;
        const gaHome = match.gaHome || 0;
        const gsAway = match.gsAway || 0;
        const gaAway = match.gaAway || 0;
        const gsUnd = isFavHome ? gsAway : gsHome;
        const gaUnd = isFavHome ? gaAway : gaHome;
        const hiddenStrength = Math.abs(gsUnd - gaUnd) <= 0.2;
        
        const mlSupportsUnderdog = (algoUnd > 30 || paaUnd > 30 || seerUnd > 30);

        if (tsSupportsUnderdog && hiddenStrength && mlSupportsUnderdog) {
            t2.total++;
            if (isFav) t2.fav++;
            if (isDraw) t2.draw++;
            if (isUnd) t2.und++;
        }

        // --- Theory 4: Extreme Volatility Grid ---
        const paaMax = Math.max(paaFav, paaDraw, paaUnd);
        const seerMax = Math.max(seerFav, seerDraw, seerUnd);
        const algoMax = Math.max(algoFav, algoDraw, algoUnd);
        
        const predictors = [];
        if (paaMax > 0) predictors.push({ name: 'PAA', max: paaMax });
        if (seerMax > 0) predictors.push({ name: 'Seer', max: seerMax });
        if (algoMax > 0) predictors.push({ name: 'Algo', max: algoMax });
        
        // Ensure we have all 3 predictors
        if (predictors.length === 3) {
            const trackVolatile = (threshold: number, phaseAll: any, phaseTwo: any) => {
                const volatilePreds = predictors.filter(p => p.max < threshold);
                const count = volatilePreds.length;
                
                const updateStats = (statsObj: any) => {
                    statsObj.total++;
                    if (isFav) statsObj.fav++;
                    if (isDraw) statsObj.draw++;
                    if (isUnd) statsObj.und++;
                };

                const updateCombo = (statsObj: any, comboName: string) => {
                    if (!statsObj.combos[comboName]) {
                        statsObj.combos[comboName] = { total: 0, fav: 0, draw: 0, und: 0 };
                    }
                    statsObj.combos[comboName].total++;
                    if (isFav) statsObj.combos[comboName].fav++;
                    if (isDraw) statsObj.combos[comboName].draw++;
                    if (isUnd) statsObj.combos[comboName].und++;
                }

                if (count === 3) {
                    updateStats(phaseAll);
                } else if (count === 2) {
                    updateStats(phaseTwo);
                    const combo = volatilePreds.map(p => p.name).sort().join('+');
                    updateCombo(phaseTwo, combo);
                }
            };

            trackVolatile(40, t4_3_40, t4_2_40);
            trackVolatile(45, t4_3_45, t4_2_45);
            trackVolatile(50, t4_3_50, t4_2_50);
        }
    }

    console.log(`Successfully processed ${validMatches} valid matches.`);

    const printStats = (name: string, stats: any) => {
        console.log(`\n=== ${name} ===`);
        console.log(`Total Matches: ${stats.total}`);
        if (stats.total > 0) {
            console.log(`M.Fav Wins:    ${stats.fav} (${((stats.fav/stats.total)*100).toFixed(1)}%)`);
            console.log(`Draws:         ${stats.draw} (${((stats.draw/stats.total)*100).toFixed(1)}%)`);
            console.log(`Underdog Wins: ${stats.und} (${((stats.und/stats.total)*100).toFixed(1)}%)`);
            console.log(`1X Coverage:   ${((stats.fav + stats.draw)/stats.total*100).toFixed(1)}%`);
            console.log(`X2 Coverage:   ${((stats.draw + stats.und)/stats.total*100).toFixed(1)}%`);
            console.log(`12 Coverage:   ${((stats.fav + stats.und)/stats.total*100).toFixed(1)}%`);
        }
        
        if (stats.combos) {
            const sortedCombos = Object.keys(stats.combos).sort((a, b) => stats.combos[b].total - stats.combos[a].total);
            console.log(`\n  Breakdown by Predictor Combo:`);
            for (let c of sortedCombos) {
                const cStats = stats.combos[c];
                if (cStats.total < 10) continue; // Skip noise
                const x2 = ((cStats.draw + cStats.und)/cStats.total*100).toFixed(1);
                const fav1x = ((cStats.fav + cStats.draw)/cStats.total*100).toFixed(1);
                console.log(`  - [${c}] (n=${cStats.total}): X2 = ${x2}% | 1X = ${fav1x}% | Und = ${((cStats.und/cStats.total)*100).toFixed(1)}%`);
            }
        }
    };

    printStats("THEORY 1: Fragile Favorite (M.Fav >= 2.0 & All Draws > 30%)", t1);
    printStats("THEORY 2: Underdog Momentum + ML Support (>30%)", t2);
    
    printStats("THEORY 4 - (3/3 PREDICTORS < 40%)", t4_3_40);
    printStats("THEORY 4 - (3/3 PREDICTORS < 45%)", t4_3_45);
    printStats("THEORY 4 - (3/3 PREDICTORS < 50%)", t4_3_50);

    printStats("THEORY 4 - (2/3 PREDICTORS < 40%)", t4_2_40);
    printStats("THEORY 4 - (2/3 PREDICTORS < 45%)", t4_2_45);
    printStats("THEORY 4 - (2/3 PREDICTORS < 50%)", t4_2_50);
}

runTests();

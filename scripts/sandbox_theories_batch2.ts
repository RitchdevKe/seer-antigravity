import fs from 'fs';
import path from 'path';

// Define MLFeatures interface locally or just extract what we need
function runTests() {
    const matchesPath = path.join(process.cwd(), 'supabase_backup/precalculated_matches.json');
    const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));

    console.log(`Loaded ${matches.length} matches.`);

    // Result tracking
    const t1 = { total: 0, fav: 0, draw: 0, und: 0 };
    const t2 = { total: 0, fav: 0, draw: 0, und: 0 };
    const t3 = { total: 0, fav: 0, draw: 0, und: 0 };
    const t4 = { total: 0, fav: 0, draw: 0, und: 0 };
    
    // Theory 5: Both Fav and Und < 3.0
    const t5_base = { total: 0, fav: 0, draw: 0, und: 0 };
    // Theory 5 sub: Both < 3.0 AND Draw > 33 (any model)
    const t5_highDraw = { total: 0, fav: 0, draw: 0, und: 0 };

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
        
        const isFavHome = hOdds <= aOdds;
        const favOdds = isFavHome ? hOdds : aOdds;
        const undOdds = isFavHome ? aOdds : hOdds;
        
        const res = match.result.split(':');
        if (res.length !== 2) continue;
        
        const homeGoals = parseInt(res[0]);
        const awayGoals = parseInt(res[1]);
        
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
        const algoDraw = match.algoReport?.probabilities?.['X'] 
                            ? (match.algoReport.probabilities['X'] <= 1 ? match.algoReport.probabilities['X'] * 100 : match.algoReport.probabilities['X']) 
                            : 0;

        const paaFav = isFavHome ? (match.paaWin||0) : (match.paaUpset||0);
        const paaUnd = isFavHome ? (match.paaUpset||0) : (match.paaWin||0);
        const seerFav = match.seerPercentages ? (isFavHome ? match.seerPercentages['1'] : match.seerPercentages['2']) : 0;
        const seerUnd = match.seerPercentages ? (isFavHome ? match.seerPercentages['2'] : match.seerPercentages['1']) : 0;
        
        const algoP1 = match.algoReport?.probabilities?.['1'] || 0;
        const algoP2 = match.algoReport?.probabilities?.['2'] || 0;
        const algoFav = (algoP1 <= 1 ? algoP1 * 100 : algoP1) === 0 ? 0 : (isFavHome ? algoP1 : algoP2) * (algoP1 <= 1 ? 100 : 1);
        const algoUnd = (algoP2 <= 1 ? algoP2 * 100 : algoP2) === 0 ? 0 : (isFavHome ? algoP2 : algoP1) * (algoP2 <= 1 ? 100 : 1);

        const maxDraw = Math.max(paaDraw, seerDraw, algoDraw);

        // --- Theory 1: Fragile Favorite (Odds >= 2.0 AND all draws > 30) ---
        if (favOdds >= 2.0 && algoDraw > 30 && paaDraw > 30 && seerDraw > 30) {
            t1.total++;
            if (isFav) t1.fav++;
            if (isDraw) t1.draw++;
            if (isUnd) t1.und++;
        }

        // --- Theory 2: Underdog Momentum ---
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

        if (tsSupportsUnderdog && hiddenStrength) {
            t2.total++;
            if (isFav) t2.fav++;
            if (isDraw) t2.draw++;
            if (isUnd) t2.und++;
        }

        // --- Theory 3: Total Agreement Mirage ---
        let paaPrim = match.paaPrimaryPrediction;
        let seerPrim = match.seerPrimaryPrediction;
        let algoPrim = match.algoReport?.primaryPrediction;
        
        // Infer Algo primary if missing
        if (!algoPrim && algoFav > 0) {
             if (algoFav > algoDraw && algoFav > algoUnd) algoPrim = favWinStr;
             else if (algoUnd > algoFav && algoUnd > algoDraw) algoPrim = undWinStr;
             else if (algoDraw > algoFav && algoDraw > algoUnd) algoPrim = 'X';
        }

        const subPrim = match.patternAnalysis?.primaryPrediction || match.subPatternOverride?.primary;
        
        if (paaPrim === favWinStr && seerPrim === favWinStr && algoPrim === favWinStr && subPrim === favWinStr) {
            if (maxDraw > 33) {
                t3.total++;
                if (isFav) t3.fav++;
                if (isDraw) t3.draw++;
                if (isUnd) t3.und++;
            }
        }

        // --- Theory 4: Extreme Volatility ---
        const paaMax = Math.max(paaFav, paaDraw, paaUnd);
        const seerMax = Math.max(seerFav, seerDraw, seerUnd);
        const algoMax = Math.max(algoFav, algoDraw, algoUnd);
        
        if (paaMax > 0 && seerMax > 0 && algoMax > 0) {
            if (paaMax < 40 && seerMax < 40 && algoMax < 40) {
                t4.total++;
                if (isFav) t4.fav++;
                if (isDraw) t4.draw++;
                if (isUnd) t4.und++;
            }
        }

        // --- Theory 5: Both odds < 3.0 ---
        if (favOdds < 3.0 && undOdds < 3.0) {
            t5_base.total++;
            if (isFav) t5_base.fav++;
            if (isDraw) t5_base.draw++;
            if (isUnd) t5_base.und++;

            if (maxDraw > 33) {
                t5_highDraw.total++;
                if (isFav) t5_highDraw.fav++;
                if (isDraw) t5_highDraw.draw++;
                if (isUnd) t5_highDraw.und++;
            }
        }
    }

    const printStats = (name: string, stats: any) => {
        console.log(`\n--- ${name} ---`);
        console.log(`Total Matches: ${stats.total}`);
        if (stats.total > 0) {
            console.log(`M.Fav Wins:    ${stats.fav} (${((stats.fav/stats.total)*100).toFixed(1)}%)`);
            console.log(`Draws:         ${stats.draw} (${((stats.draw/stats.total)*100).toFixed(1)}%)`);
            console.log(`Underdog Wins: ${stats.und} (${((stats.und/stats.total)*100).toFixed(1)}%)`);
            
            const p1x = ((stats.fav + stats.draw)/stats.total*100).toFixed(1);
            const px2 = ((stats.draw + stats.und)/stats.total*100).toFixed(1);
            const p12 = ((stats.fav + stats.und)/stats.total*100).toFixed(1);
            console.log(`1X Coverage:   ${p1x}%`);
            console.log(`X2 Coverage:   ${px2}%`);
            console.log(`12 Coverage:   ${p12}%`);
        }
    };

    printStats("THEORY 1: Fragile Favorite (Fav Odds >= 2.0 & All Draws > 30%)", t1);
    printStats("THEORY 2: Underdog Momentum (TS > Fav & GS=GA+-0.2)", t2);
    printStats("THEORY 3: Agreement Mirage (All Prim=Fav but MaxDraw > 33%)", t3);
    printStats("THEORY 4: Extreme Volatility (All Predictors Max < 40%)", t4);
    printStats("THEORY 5A: Low Odds Collision (Fav < 3.0 AND Und < 3.0)", t5_base);
    printStats("THEORY 5B: Low Odds Collision + High Draw (MaxDraw > 33%)", t5_highDraw);
}

runTests();

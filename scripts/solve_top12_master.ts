import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const catalog: Array<{ index: number; description: string; currentPoints: number; isBorrowed?: boolean }> = JSON.parse(
  fs.readFileSync(`${outDir}\\augmented_top12_catalog.json`, 'utf8')
);
const matrix: Array<{
  id: string | number;
  teams: string;
  result: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  triggeredIndices: number[];
  triggeredDescriptions: string[];
}> = JSON.parse(fs.readFileSync(`${outDir}\\augmented_top12_matrix.json`, 'utf8'));

const getWeights = (config: Record<string, number>) => {
  const w = new Array(catalog.length).fill(0);
  for (const [desc, pts] of Object.entries(config)) {
    const item = catalog.find(r => r.description === desc);
    if (item) {
      w[item.index] = pts;
    }
  }
  return w;
};

// Base config from domain specialists
const baseConfig: Record<string, number> = {
  // 1. Guardrails & Inert Anti-Risk Rules
  "Match belongs to an african country league": -10,
  "Banned: Upset risk tag": -15,
  "Banned: Upset risk and Banned: Draw risk tags": -20,
  "Seer score on underdog >= 45%": -25,
  "Seer score on draw >= 35%": -10,
  "Seer score on draw <= 20%": 15,
  "Seer primary predicts on underdog": -20,
  "Algo primary prediction supports the underdog": -15,
  "Sub pattern primary prediction supports the underdog": -20,
  "A match has GS=GS=GA=GA": -10,

  // 2. Traps and Loss Suppressors
  "M.fav has hidden strength": -15,
  "Both team GS => 1.8": -15,
  "Underdog GA= >1.5 and GS =>1.8": -15,
  "Team A and Team B GS >= 2.0 and GA >= 1.0": -15,
  "Volatile False Favorite Trap": -25,
  "M.fav GA is > 0.6 points lower than Underdog GA": -15,
  "Point system has >= 50 to <60 points on M.fav": -10,
  "Both teams GA >= 1.1 (volatile match) + Mfav TS 1.0-1.50 and Ud TS < 0.8": -15,
  "Odds for underdog <= odds for draw but < 2.8": -15,
  "Both teams GA >= 1.1 (volatile match) + Odds for underdog <= odds for draw but >= 3.0": -15,
  "High Favorite Odds (>= 2.50)": -15,
  "Point System Inversion (Underdog points > Favorite)": -15,
  "Underdog has >= 5 more points on point system": -15,
  "Underdog has hidden weakness": -5,
  "Equal GS + AGA=HGS + M.fav has hidden strength": -15,
  "Equal GS + AGA=HGS + M.fav has hidden weakness": -10,
  "Mfav TS 1.0-1.50 and Ud TS < 0.8": -15,
  "Underdog TS > M.fav TS": -15,
  "Mfav TS >= 3.0 and Ud TS <= 1.7 and MFAV GS ≈ UND GS": -10,
  "Both teams GS < 1.0 and Both team GS <GA": 0,
  "Odds for underdog < 2.8": -15,
  "Odds for underdog >= 2.80 to 3.0": -5,
  "Both teams GA > GS": -10,
  "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA": -10,
  "PAA, SubPattern, and Algo agree on 12 hedge": -10,
  "PAA, SubPattern, Algo, and ML agree on 12 hedge": -15,
  "Algo for Mfav support <40%": -5,
  "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12": -10,
  "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -5,
  "Odds for underdog <= odds for draw but >= 3.0": -10,
  "Both team TS <= 1.0": -10,
  "Away Favorite Razor Parity (Diff < 0.20)": -5,
  "M.fav and Underdog TS difference <= 0.1": -10,
  "Both team TS difference less than 0.4 + Seer score on draw >= 35%": -10,
  "Both team TS difference less than 0.4 + PAA, SubPattern, Algo, and ML agree on 12 hedge + Odds for underdog <= odds for draw but >= 3.0": -15,

  // Borrowed Traps
  "LE, Underdog won the last encounter +Mfav L10= Und L10": -20,
  "Underdog was away on LE (Last encounter) and Won": -20,
  "LE was a draw+1X2R <= 2.5": -15,
  "Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0": -10,
  "Mfav GS =>1.8 and GA =<1.0": -15,

  // 3. Positive Win Drivers (Outright Mfav & 1X High Conviction)
  "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": 15,
  "Both teams GS < 1.0": 15,
  "High Conviction Defense + Attack Dominance": 20,
  "1X2 supports the underdog": 5,
  "Odds for underdog <= odds for draw but between 2.8 to 3.0": 10,
  "Underdog has hidden strength": 5,
  "M.fav has hidden weakness": 5,
  "Algo support for Mfav is 45-50%": 15,
  "Algo support for Mfav > 50%": 10,
  "Algo final prediction is 1X/X2": 15,
  "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": 15,
  "PAA, Seer, and ML agree on 1X/X2": 5,
  "PAA, Seer, Algo, and ML agree on 1X/X2": 15,
  "Odds for draw is < 3.0": 10,
  "Mfav GA <= 1.0 but Underdog GA > 1.0": 15,
  "Mfav GS = Und Gs +-0.2": 10,
  "HGA=AGS + Equal GS": 10,
  "Underdog GS < 1.0 but M.fav GS > 1.0": 10,
  "Point system has >= 70 points on M.fav": 15,
  "Point system has >= 60 to <70 points on M.fav": 5,
  "PHA on Mfav >= 70%": 20,
  "PHA on Mfav >= 60 to <70%": 10,
  "PHA on Mfav >= 55% to < 60%": 5,
  "PHA M.fav <= 40%": -10,
  "Mfav TS >= 2.0 and Underdog TS < 0.7": 10,
  "Mfav TS >= 3.0 and Ud TS < 0.8": 10,
  "Mfav TS 1.5-1.99 and Ud TS < 0.5": 5,
  "Underdog GA >= 2.0": 0,
  "Both teams GA >= 1.1 (volatile match)": 0,
  "Both team TS difference less than 0.4": 0,
  "Mfav GA=Und GA (+-0.2)": 0,
  "Mfav GA>1.0 and Under Dog GA =>1.0": 0,

  // Borrowed Positive Drivers
  "LE was a draw+Underdog has hidden strength/weakness": 20,
  "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 15,
  "LE was a draw+ Mfav GA and GS =>1.8": 15,
  "Both teams GA > GS and Both team GS <=1.0": 10,
  "1X2 Rating =>7": 15,
  "Synergy: Both TS <= 1.0 + Pred 1X2 on M.fav": 10,
  "Mfav GS - Ud GS >= 1.0": 10,
  "LE was a draw": 5
};

function runEval(currentWeights: number[], label: string) {
  const scored = matrix.map(m => {
    let score = m.basePoints;
    for (const idx of m.triggeredIndices) {
      if (idx < currentWeights.length) {
        score += currentWeights[idx];
      }
    }
    return {
      id: m.id,
      teams: m.teams,
      result: m.result,
      outcome: m.outcome,
      totalScore: score
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const calc = (slice: any[]) => {
    const mfav = slice.filter(x => x.outcome === 'MFAV').length;
    const draw = slice.filter(x => x.outcome === 'DRAW').length;
    const ud = slice.filter(x => x.outcome === 'UNDERDOG').length;
    return {
      total: slice.length,
      mfav,
      draw,
      ud,
      mfavPct: ((mfav / slice.length) * 100).toFixed(1) + '%',
      hedged1XPct: (((mfav + draw) / slice.length) * 100).toFixed(1) + '%'
    };
  };

  const top12 = calc(scored.slice(0, 12));
  const top20 = calc(scored.slice(0, 20));
  const top30 = calc(scored.slice(0, 30));

  let cleanStreakMfav = 0;
  for (const m of scored) {
    if (m.outcome === 'MFAV') cleanStreakMfav++;
    else break;
  }

  let cleanStreak1X = 0;
  for (const m of scored) {
    if (m.outcome === 'MFAV' || m.outcome === 'DRAW') cleanStreak1X++;
    else break;
  }

  const firstUd = scored.find(m => m.outcome === 'UNDERDOG');
  const firstUdRank = firstUd ? scored.findIndex(m => m.id === firstUd.id) + 1 : -1;

  const top12MinScore = scored[11].totalScore;
  const maxUdScore = firstUd ? firstUd.totalScore : 0;
  const bufferGap = top12MinScore - maxUdScore;

  console.log(`\n================== ${label} ==================`);
  console.log('Top 12:', top12);
  console.log('Top 20:', top20);
  console.log('Top 30:', top30);
  console.log(`Clean M.Fav Win Streak: ${cleanStreakMfav}`);
  console.log(`Clean 1X Hedged Streak (no Underdog loss): ${cleanStreak1X}`);
  console.log(`First Underdog Loss Rank: #${firstUdRank} (${firstUd?.teams}, ${firstUd?.result}, ${firstUd?.totalScore} pts)`);
  console.log(`Score Cushion Gap (Top 12 Min Score [${top12MinScore} pts] vs Max Underdog Loss [${maxUdScore} pts]): ${bufferGap >= 0 ? '+' : ''}${bufferGap} pts`);

  console.log('\nTop 20 Matches:');
  scored.slice(0, 20).forEach((m, idx) => {
    console.log(`#${idx + 1} [${m.totalScore} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
  });

  return { scored, top12, top20, top30, bufferGap, firstUdRank };
}

const w = getWeights(baseConfig);
runEval(w, "BALANCED MASTER MODEL (PEAK 1X CONVICTION)");

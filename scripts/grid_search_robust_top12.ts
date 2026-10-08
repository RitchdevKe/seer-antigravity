import fs from 'fs';

const combinedPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_top12_matches.json';
const matches: Array<{
  id: any;
  teams: string;
  result: string;
  actual: string;
  mFav: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  score: number;
  rulesHit: Array<{ description: string; points: number }>;
  batch: string;
  match: any;
}> = JSON.parse(fs.readFileSync(combinedPath, 'utf8'));

const satMatches = matches.filter(m => m.batch.includes('Saturday'));
const sunMatches = matches.filter(m => m.batch.includes('Sunday'));

function evalSet(matchList: typeof matches, pointMap: Record<string, number>, topN: number = 12) {
  const scored = matchList.map(m => {
    let base = m.match?.baseInfo?.points;
    if (base === undefined || isNaN(base)) base = 50;

    let score = base;
    m.rulesHit.forEach(r => {
      const pts = pointMap[r.description] !== undefined ? pointMap[r.description] : r.points;
      score += pts;
    });

    return {
      teams: m.teams,
      result: m.result,
      outcome: m.outcome,
      score
    };
  }).sort((a, b) => b.score - a.score);

  const slice = scored.slice(0, topN);
  const mfav = slice.filter(m => m.outcome === 'MFAV').length;
  const draw = slice.filter(m => m.outcome === 'DRAW').length;
  const ud = slice.filter(m => m.outcome === 'UNDERDOG').length;
  return {
    success: mfav + draw,
    mfav,
    draw,
    ud
  };
}

const baseMap: Record<string, number> = {
  "Seer score on draw <= 20%": 0,
  "Odds for underdog <= odds for draw but between 2.8 to 3.0": -15,
  "1X2 Rating =>7": -10,
  "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": -10,
  "High Conviction Defense + Attack Dominance": 0,
  "Mfav GS - Ud GS >= 1.0": 0,
  "Point system has >= 60 to <70 points on M.fav": -5,
  "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 0,
  "Both teams GA > GS and Both team GS <=1.0": 0,
  "Mfav GS = Und Gs +-0.2": 0,
  "Odds for draw is < 3.0": 15,
  "LE was a draw+Underdog has hidden strength/weakness": 20,
  "Algo support for Mfav is 45-50%": 15,
  "Point system has >= 70 points on M.fav": 15
};

// Test varying "All predictors agree on 1X/X2" and "Mfav GA <= 1.0 but Underdog GA > 1.0"
const testValues = [15, 10, 5, 0, -5];

let bestScore = 0;
let bestParams: any = null;

for (const allPredPts of [10, 5, 0]) {
  for (const mfavGaPts of [10, 5, 0]) {
    for (const tsPts of [-15, -20]) { // Mfav TS 1.0-1.50 and Ud TS < 0.8
      const currentMap = {
        ...baseMap,
        "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": allPredPts,
        "Mfav GA <= 1.0 but Underdog GA > 1.0": mfavGaPts,
        "Mfav TS 1.0-1.50 and Ud TS < 0.8": tsPts
      };

      const satRes = evalSet(satMatches, currentMap, 12);
      const sunRes = evalSet(sunMatches, currentMap, 12);
      const combRes = evalSet(matches, currentMap, 12);

      const totalWins = satRes.success + sunRes.success;
      if (totalWins > bestScore || (totalWins === bestScore && combRes.success > (bestParams?.combRes?.success || 0))) {
        bestScore = totalWins;
        bestParams = { allPredPts, mfavGaPts, tsPts, satRes, sunRes, combRes };
      }
    }
  }
}

console.log("BEST PARAMETERS FOUND:");
console.log(JSON.stringify(bestParams, null, 2));

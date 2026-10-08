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
    ud,
    pct: (((mfav + draw) / topN) * 100).toFixed(1) + '%'
  };
}

const refinedMap: Record<string, number> = {
  // Eliminate ghost trigger
  "Seer score on draw <= 20%": 0,

  // Neutralize unstable / overfitted false bonuses
  "Odds for underdog <= odds for draw but between 2.8 to 3.0": -15,
  "1X2 Rating =>7": -10,
  "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": -10,
  "High Conviction Defense + Attack Dominance": 0,
  "Mfav GS - Ud GS >= 1.0": 0,
  "Point system has >= 60 to <70 points on M.fav": -5,
  "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 0,
  "Both teams GA > GS and Both team GS <=1.0": 0,
  "Mfav GS = Und Gs +-0.2": 0,
  "Underdog has hidden strength": 0, // was +5

  // Severely penalize weak favorite offense
  "Mfav TS 1.0-1.50 and Ud TS < 0.8": -25, // was -15
  "Both teams GA >= 1.1 (volatile match) + Mfav TS 1.0-1.50 and Ud TS < 0.8": -25,

  // Prune compound rules with low Sunday sample
  "LE was a draw+Underdog has hidden strength/weakness": 5, // was +20

  // Keep true robust win drivers
  "Odds for draw is < 3.0": 15,
  "Algo support for Mfav is 45-50%": 15,
  "Point system has >= 70 points on M.fav": 15,
  "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": 5,
  "Mfav GA <= 1.0 but Underdog GA > 1.0": 5
};

console.log("REFINED MODEL RESULTS:");
console.log("Saturday Top 12:", evalSet(satMatches, refinedMap, 12));
console.log("Sunday Top 12:  ", evalSet(sunMatches, refinedMap, 12));
console.log("Combined Top 12:", evalSet(matches, refinedMap, 12));
console.log("\nTop 20 Results:");
console.log("Saturday Top 20:", evalSet(satMatches, refinedMap, 20));
console.log("Sunday Top 20:  ", evalSet(sunMatches, refinedMap, 20));
console.log("Combined Top 20:", evalSet(matches, refinedMap, 20));

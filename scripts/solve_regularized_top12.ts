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

function evaluate(matchList: typeof matches, pointMap: Record<string, number>, topN: number = 12) {
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
  const success = mfav + draw;

  let cleanStreak = 0;
  for (const m of scored) {
    if (m.outcome !== 'UNDERDOG') cleanStreak++;
    else break;
  }

  const firstUd = scored.find(m => m.outcome === 'UNDERDOG');
  const firstUdRank = firstUd ? scored.findIndex(m => m === firstUd) + 1 : -1;

  return {
    topN,
    success,
    successPct: ((success / topN) * 100).toFixed(1) + '%',
    mfav,
    draw,
    ud,
    cleanStreak,
    firstUdRank
  };
}

// Test conservative regularization:
// 1. Ghost trigger eliminated
// 2. Unstable bonuses removed or neutralized
// 3. Danger signals penalized
const candidateMap: Record<string, number> = {
  // Eliminate ghost trigger
  "Seer score on draw <= 20%": 0,

  // Neutralize unstable / overfitted false bonuses
  "Odds for underdog <= odds for draw but between 2.8 to 3.0": -15, // Was +10!
  "1X2 Rating =>7": -10, // Was +15!
  "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": -10, // Was +15!
  "High Conviction Defense + Attack Dominance": 5, // Was +20!
  "Mfav GS - Ud GS >= 1.0": 0, // Was +10!
  "Point system has >= 60 to <70 points on M.fav": -5, // Was +5!
  "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 0, // Was +15!
  "Both teams GA > GS and Both team GS <=1.0": 0, // Was +10!
  "Mfav GS = Und Gs +-0.2": 0, // Was +10!

  // Keep true robust win drivers
  "Odds for draw is < 3.0": 15,
  "LE was a draw+Underdog has hidden strength/weakness": 20,
  "Algo support for Mfav is 45-50%": 15,
  "Point system has >= 70 points on M.fav": 15
};

console.log(`\n======================================================`);
console.log(`REGULARIZED CROSS-DAY CANDIDATE MODEL RESULTS`);
console.log(`======================================================`);
console.log(`Saturday Top 12:`, evaluate(satMatches, candidateMap, 12));
console.log(`Sunday Top 12:  `, evaluate(sunMatches, candidateMap, 12));
console.log(`Combined Top 12:`, evaluate(matches, candidateMap, 12));

console.log(`\nTop 20 Evaluation:`);
console.log(`Saturday Top 20:`, evaluate(satMatches, candidateMap, 20));
console.log(`Sunday Top 20:  `, evaluate(sunMatches, candidateMap, 20));
console.log(`Combined Top 20:`, evaluate(matches, candidateMap, 20));

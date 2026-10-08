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

// Extract base points and rule descriptions for each match
const satMatches = matches.filter(m => m.batch.includes('Saturday'));
const sunMatches = matches.filter(m => m.batch.includes('Sunday'));

console.log(`Saturday matches: ${satMatches.length}`);
console.log(`Sunday matches:   ${sunMatches.length}`);
console.log(`Total matches:    ${matches.length}`);

// Calculate 1X hedged stats for a ranked list
function evaluateRankings(rankedList: Array<{ outcome: string; teams: string; result: string; score: number }>, topN: number = 12) {
  const slice = rankedList.slice(0, topN);
  const mfav = slice.filter(m => m.outcome === 'MFAV').length;
  const draw = slice.filter(m => m.outcome === 'DRAW').length;
  const ud = slice.filter(m => m.outcome === 'UNDERDOG').length;
  const success = mfav + draw;

  let cleanStreak = 0;
  for (const m of rankedList) {
    if (m.outcome !== 'UNDERDOG') cleanStreak++;
    else break;
  }

  const firstUd = rankedList.find(m => m.outcome === 'UNDERDOG');
  const firstUdRank = firstUd ? rankedList.findIndex(m => m === firstUd) + 1 : -1;

  return {
    topN,
    success,
    successPct: ((success / topN) * 100).toFixed(1) + '%',
    mfav,
    draw,
    ud,
    cleanStreak,
    firstUdRank,
    firstUdMatch: firstUd ? `${firstUd.teams} (${firstUd.result}, ${firstUd.score} pts)` : 'None'
  };
}

// Current points evaluation
function scoreMatches(matchList: typeof matches, pointOverrides: Record<string, number> = {}) {
  return matchList.map(m => {
    let score = m.match?.baseInfo?.points || 50; // fallback base
    // Use the actual rules triggered
    m.rulesHit.forEach(r => {
      const pts = pointOverrides[r.description] !== undefined ? pointOverrides[r.description] : r.points;
      score += pts;
    });

    return {
      teams: m.teams,
      result: m.result,
      outcome: m.outcome,
      score
    };
  }).sort((a, b) => b.score - a.score);
}

console.log(`\n======================================================`);
console.log(`1. CURRENT CODE EVALUATION (OVERFITTED ON SATURDAY)`);
console.log(`======================================================`);
console.log(`Saturday Top 12:`, evaluateRankings(scoreMatches(satMatches), 12));
console.log(`Sunday Top 12:  `, evaluateRankings(scoreMatches(sunMatches), 12));
console.log(`Combined Top 12:`, evaluateRankings(scoreMatches(matches), 12));


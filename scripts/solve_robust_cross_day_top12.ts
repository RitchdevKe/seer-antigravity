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

// 1. First: Test an All-Zero Points schedule (Base points only)
function scoreMatches(matchList: typeof matches, pointOverrides: Record<string, number> = {}) {
  return matchList.map(m => {
    // Determine base points
    let base = m.match?.baseInfo?.points;
    if (base === undefined || isNaN(base)) base = 50;

    let score = base;
    m.rulesHit.forEach(r => {
      const pts = pointOverrides[r.description] !== undefined ? pointOverrides[r.description] : 0;
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

function calc(rankedList: any[], topN: number = 12) {
  const slice = rankedList.slice(0, topN);
  const mfav = slice.filter(m => m.outcome === 'MFAV').length;
  const draw = slice.filter(m => m.outcome === 'DRAW').length;
  const ud = slice.filter(m => m.outcome === 'UNDERDOG').length;
  const success = mfav + draw;
  return {
    topN,
    success,
    successPct: ((success / topN) * 100).toFixed(1) + '%',
    mfav,
    draw,
    ud
  };
}

console.log(`\n======================================================`);
console.log(`BASELINE: ALL RULES SET TO ZERO (BASE POINTS ONLY)`);
console.log(`======================================================`);
console.log(`Saturday Top 12 (Zero Rules):`, calc(scoreMatches(satMatches, {}), 12));
console.log(`Sunday Top 12   (Zero Rules):`, calc(scoreMatches(sunMatches, {}), 12));
console.log(`Combined Top 12 (Zero Rules):`, calc(scoreMatches(matches, {}), 12));

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

const candidateMap: Record<string, number> = {
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
  "Underdog has hidden strength": 0,
  "Mfav TS 1.0-1.50 and Ud TS < 0.8": -25,
  "Both teams GA >= 1.1 (volatile match) + Mfav TS 1.0-1.50 and Ud TS < 0.8": -25,
  "LE was a draw+Underdog has hidden strength/weakness": 5,
  "Odds for draw is < 3.0": 15,
  "Algo support for Mfav is 45-50%": 15,
  "Point system has >= 70 points on M.fav": 15,
  "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": 5,
  "Mfav GA <= 1.0 but Underdog GA > 1.0": 5
};

function scoreMatches(matchList: typeof matches) {
  return matchList.map(m => {
    let base = m.match?.baseInfo?.points;
    if (base === undefined || isNaN(base)) base = 50;

    let score = base;
    m.rulesHit.forEach(r => {
      const pts = candidateMap[r.description] !== undefined ? candidateMap[r.description] : r.points;
      score += pts;
    });

    return {
      teams: m.teams,
      result: m.result,
      outcome: m.outcome,
      score,
      batch: m.batch,
      rulesHit: m.rulesHit
    };
  }).sort((a, b) => b.score - a.score);
}

const satScored = scoreMatches(satMatches);
const sunScored = scoreMatches(sunMatches);

console.log(`\n--- SATURDAY TOP 12 UNDER CANDIDATE MODEL ---`);
satScored.slice(0, 12).forEach((m, idx) => {
  const mark = m.outcome === 'UNDERDOG' ? '❌ [UNDERDOG LOSS]' : '✅ [1X SUCCESS]';
  console.log(`#${idx + 1} [${m.score} pts] ${mark} [${m.outcome}] ${m.teams} (${m.result})`);
  if (m.outcome === 'UNDERDOG') {
    m.rulesHit.forEach(r => console.log(`      - [${candidateMap[r.description] ?? r.points} pts] ${r.description}`));
  }
});

console.log(`\n--- SUNDAY TOP 12 UNDER CANDIDATE MODEL ---`);
sunScored.slice(0, 12).forEach((m, idx) => {
  const mark = m.outcome === 'UNDERDOG' ? '❌ [UNDERDOG LOSS]' : '✅ [1X SUCCESS]';
  console.log(`#${idx + 1} [${m.score} pts] ${mark} [${m.outcome}] ${m.teams} (${m.result})`);
  if (m.outcome === 'UNDERDOG') {
    m.rulesHit.forEach(r => console.log(`      - [${candidateMap[r.description] ?? r.points} pts] ${r.description}`));
  }
});

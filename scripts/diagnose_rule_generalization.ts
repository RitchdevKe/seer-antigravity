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

console.log(`Analyzing ${matches.length} total matches...`);

// Rule-by-rule statistics broken down by Saturday and Sunday
interface RuleStat {
  description: string;
  points: number;
  satTotal: number;
  satMfav: number;
  satDraw: number;
  satUd: number;
  sunTotal: number;
  sunMfav: number;
  sunDraw: number;
  sunUd: number;
}

const ruleMap = new Map<string, RuleStat>();

matches.forEach(m => {
  const isSat = m.batch.includes('Saturday');
  m.rulesHit.forEach(r => {
    if (!ruleMap.has(r.description)) {
      ruleMap.set(r.description, {
        description: r.description,
        points: r.points,
        satTotal: 0,
        satMfav: 0,
        satDraw: 0,
        satUd: 0,
        sunTotal: 0,
        sunMfav: 0,
        sunDraw: 0,
        sunUd: 0
      });
    }

    const stat = ruleMap.get(r.description)!;
    if (isSat) {
      stat.satTotal++;
      if (m.outcome === 'MFAV') stat.satMfav++;
      else if (m.outcome === 'DRAW') stat.satDraw++;
      else stat.satUd++;
    } else {
      stat.sunTotal++;
      if (m.outcome === 'MFAV') stat.sunMfav++;
      else if (m.outcome === 'DRAW') stat.sunDraw++;
      else stat.sunUd++;
    }
  });
});

console.log(`\n========================================================================================`);
console.log(`RULE GENERALIZATION AUDIT: SATURDAY VS SUNDAY`);
console.log(`========================================================================================`);

const statsList = Array.from(ruleMap.values());

// Filter to rules with points !== 0
const activeRules = statsList.filter(s => s.points !== 0);

console.log(`\n--- RULES WITH POSITIVE BONUS THAT FAILED ON SUNDAY (UNDERDOG LOSSES) ---`);
const failingBonuses = activeRules
  .filter(s => s.points > 0 && s.sunUd > 0)
  .sort((a, b) => b.sunUd - a.sunUd);

failingBonuses.forEach(s => {
  const sat1XRate = s.satTotal > 0 ? (((s.satMfav + s.satDraw) / s.satTotal) * 100).toFixed(1) + '%' : 'N/A';
  const sun1XRate = s.sunTotal > 0 ? (((s.sunMfav + s.sunDraw) / s.sunTotal) * 100).toFixed(1) + '%' : 'N/A';
  const sunUdRate = s.sunTotal > 0 ? ((s.sunUd / s.sunTotal) * 100).toFixed(1) + '%' : 'N/A';

  console.log(`[${s.points > 0 ? '+' : ''}${s.points} pts] "${s.description}"`);
  console.log(`    Sat: ${s.satTotal} matches (1X: ${sat1XRate}, UD: ${s.satUd}) | Sun: ${s.sunTotal} matches (1X: ${sun1XRate}, UD: ${s.sunUd} [${sunUdRate}])`);
});

console.log(`\n--- INSPECTION OF UNINITIALIZED / ZERO SEER DRAW SCORES ---`);
let uninitSat = 0;
let uninitSun = 0;

matches.forEach(m => {
  const isSat = m.batch.includes('Saturday');
  const seerScoreDraw = m.match?.seerScores?.['X'] || m.match?.seerPercentages?.['X'] || 0;
  if (!seerScoreDraw || seerScoreDraw === 0) {
    if (isSat) uninitSat++;
    else uninitSun++;
  }
});

console.log(`Matches with uninitialized / zero seerScoreDraw:`);
console.log(`  Saturday: ${uninitSat} / 205 (${((uninitSat/205)*100).toFixed(1)}%)`);
console.log(`  Sunday:   ${uninitSun} / 126 (${((uninitSun/126)*100).toFixed(1)}%)`);

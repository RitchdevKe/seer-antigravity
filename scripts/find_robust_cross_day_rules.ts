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

interface RuleAudit {
  description: string;
  currentPoints: number;
  totalMatches: number;
  total1X: number;
  totalUd: number;
  overall1XPct: number;
  overallUdPct: number;
  satMatches: number;
  sat1XPct: number;
  sunMatches: number;
  sun1XPct: number;
  stabilityScore: number; // Low variance between Sat and Sun
}

const map = new Map<string, {
  points: number;
  satTotal: number; sat1X: number; satUd: number;
  sunTotal: number; sun1X: number; sunUd: number;
}>();

matches.forEach(m => {
  const isSat = m.batch.includes('Saturday');
  const is1X = m.outcome === 'MFAV' || m.outcome === 'DRAW';

  m.rulesHit.forEach(r => {
    if (!map.has(r.description)) {
      map.set(r.description, {
        points: r.points,
        satTotal: 0, sat1X: 0, satUd: 0,
        sunTotal: 0, sun1X: 0, sunUd: 0
      });
    }

    const item = map.get(r.description)!;
    if (isSat) {
      item.satTotal++;
      if (is1X) item.sat1X++;
      else item.satUd++;
    } else {
      item.sunTotal++;
      if (is1X) item.sun1X++;
      else item.sunUd++;
    }
  });
});

const results: RuleAudit[] = [];

map.forEach((data, description) => {
  const totalMatches = data.satTotal + data.sunTotal;
  const total1X = data.sat1X + data.sun1X;
  const totalUd = data.satUd + data.sunUd;
  const overall1XPct = (total1X / totalMatches) * 100;
  const overallUdPct = (totalUd / totalMatches) * 100;

  const sat1XPct = data.satTotal > 0 ? (data.sat1X / data.satTotal) * 100 : overall1XPct;
  const sun1XPct = data.sunTotal > 0 ? (data.sun1X / data.sunTotal) * 100 : overall1XPct;

  // Stability: penalty for large variance between Sat and Sun
  const variance = Math.abs(sat1XPct - sun1XPct);
  const stabilityScore = 100 - variance;

  results.push({
    description,
    currentPoints: data.points,
    totalMatches,
    total1X,
    totalUd,
    overall1XPct,
    overallUdPct,
    satMatches: data.satTotal,
    sat1XPct,
    sunMatches: data.sunTotal,
    sun1XPct,
    stabilityScore
  });
});

console.log(`\n========================================================================================`);
console.log(`1. ROBUST UNIVERSAL WIN DRIVERS (High 1X Rate on BOTH Days & Sample >= 10)`);
console.log(`========================================================================================`);

const winDrivers = results
  .filter(r => r.totalMatches >= 10 && r.sat1XPct >= 75 && r.sun1XPct >= 70 && r.overall1XPct >= 75)
  .sort((a, b) => b.overall1XPct - a.overall1XPct);

winDrivers.forEach(r => {
  console.log(`[Current: ${r.currentPoints >= 0 ? '+' : ''}${r.currentPoints} pts] "${r.description}"`);
  console.log(`    Total: ${r.totalMatches} matches | 1X Rate: ${r.overall1XPct.toFixed(1)}% (UD: ${r.totalUd}) | Sat: ${r.sat1XPct.toFixed(1)}% (${r.satMatches}m) | Sun: ${r.sun1XPct.toFixed(1)}% (${r.sunMatches}m)`);
});

console.log(`\n========================================================================================`);
console.log(`2. SEVERE UNDERDOG TRAPS (High Underdog Upset Rate on BOTH Days or High Combined UD)`);
console.log(`========================================================================================`);

const riskTraps = results
  .filter(r => r.totalMatches >= 10 && (r.overallUdPct >= 35 || r.sun1XPct <= 60))
  .sort((a, b) => b.overallUdPct - a.overallUdPct);

riskTraps.forEach(r => {
  console.log(`[Current: ${r.currentPoints >= 0 ? '+' : ''}${r.currentPoints} pts] "${r.description}"`);
  console.log(`    Total: ${r.totalMatches} matches | UD Upset Rate: ${r.overallUdPct.toFixed(1)}% (UD: ${r.totalUd}) | Sat: ${r.sat1XPct.toFixed(1)}% | Sun: ${r.sun1XPct.toFixed(1)}%`);
});

console.log(`\n========================================================================================`);
console.log(`3. UNSTABLE / OVERFITTED RULES (Massive Variance Between Saturday and Sunday >= 25%)`);
console.log(`========================================================================================`);

const unstable = results
  .filter(r => r.totalMatches >= 10 && Math.abs(r.sat1XPct - r.sun1XPct) >= 25)
  .sort((a, b) => Math.abs(b.sat1XPct - b.sun1XPct) - Math.abs(a.sat1XPct - a.sun1XPct));

unstable.forEach(r => {
  const diff = Math.abs(r.sat1XPct - r.sun1XPct).toFixed(1);
  console.log(`[Diff: ${diff}%] [Current: ${r.currentPoints >= 0 ? '+' : ''}${r.currentPoints} pts] "${r.description}"`);
  console.log(`    Sat: ${r.sat1XPct.toFixed(1)}% (${r.satMatches}m) vs Sun: ${r.sun1XPct.toFixed(1)}% (${r.sunMatches}m) | Total: ${r.totalMatches}m`);
});

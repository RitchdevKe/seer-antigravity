import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const catalog: Array<{
  id: number;
  description: string;
  category: string;
  defaultPoints: number;
}> = JSON.parse(fs.readFileSync(`${outDir}\\upsets_augmented_catalog.json`, 'utf8'));

const matrix: Array<{
  id: any;
  teams: string;
  league: string;
  result: string;
  actual: string;
  mFav: string;
  moUnderdog: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  batch: string;
  triggeredRuleIds: number[];
  triggeredDescriptions: string[];
}> = JSON.parse(fs.readFileSync(`${outDir}\\upsets_augmented_matrix.json`, 'utf8'));

const satMatches = matrix.filter(m => m.batch.includes('Saturday'));
const sunMatches = matrix.filter(m => m.batch.includes('Sunday'));

console.log(`Loaded ${catalog.length} catalog rules, ${matrix.length} total matches (${satMatches.length} Sat, ${sunMatches.length} Sun).`);

function evaluateWeights(weights: Record<number, number>, printDetails: boolean = false) {
  function evalSubset(subset: typeof matrix, label: string) {
    const scored = subset.map(m => {
      let totalScore = m.basePoints;
      m.triggeredRuleIds.forEach(id => {
        totalScore += (weights[id] ?? 0);
      });
      return { ...m, totalScore };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);

    const top5 = scored.slice(0, 5);
    const top10 = scored.slice(0, 10);
    const top20 = scored.slice(0, 20);

    const ud5 = top5.filter(m => m.outcome === 'UNDERDOG').length;
    const ud10 = top10.filter(m => m.outcome === 'UNDERDOG').length;
    const ud20 = top20.filter(m => m.outcome === 'UNDERDOG').length;

    const dr5 = top5.filter(m => m.outcome === 'DRAW').length;
    const dr10 = top10.filter(m => m.outcome === 'DRAW').length;
    const dr20 = top20.filter(m => m.outcome === 'DRAW').length;

    const mf5 = top5.filter(m => m.outcome === 'MFAV').length;
    const mf10 = top10.filter(m => m.outcome === 'MFAV').length;
    const mf20 = top20.filter(m => m.outcome === 'MFAV').length;

    const brightonRank = scored.findIndex(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal')) + 1;
    const brightonScore = scored.find(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal'))?.totalScore;

    if (printDetails) {
      console.log(`\n--- ${label.toUpperCase()} TOP 10 ---`);
      top10.forEach((m, idx) => {
        const mark = m.outcome === 'UNDERDOG' ? '✅ UD' : (m.outcome === 'DRAW' ? '⚠️ DR' : '❌ MF');
        console.log(`${(idx + 1).toString().padStart(2)}. [${mark}] ${m.teams.padEnd(35)} | Res: ${m.result.padEnd(5)} | Score: ${m.totalScore}`);
      });
      if (label.includes('Saturday')) {
        console.log(`Brighton vs Arsenal Rank: #${brightonRank} (Score: ${brightonScore})`);
      }
    }

    return {
      label,
      ud5, ud10, ud20,
      dr5, dr10, dr20,
      mf5, mf10, mf20,
      brightonRank,
      brightonScore,
      scored
    };
  }

  const sat = evalSubset(satMatches, 'Saturday');
  const sun = evalSubset(sunMatches, 'Sunday');
  const comb = evalSubset(matrix, 'Combined');

  return { sat, sun, comb };
}

// 1. BASELINE: ALL RULES = 0
console.log('========================================================================');
console.log('1. BASELINE TEST (All Rules = 0 Points, pure Underdog PHA base weight)');
console.log('========================================================================');
const zeroWeights: Record<number, number> = {};
catalog.forEach(c => zeroWeights[c.id] = 0);
const baseRes = evaluateWeights(zeroWeights, true);
console.log(`Saturday: Top 5: ${baseRes.sat.ud5}/5 (${(baseRes.sat.ud5/5*100).toFixed(1)}%) | Top 10: ${baseRes.sat.ud10}/10 (${(baseRes.sat.ud10/10*100).toFixed(1)}%) | Top 20: ${baseRes.sat.ud20}/20 (${(baseRes.sat.ud20/20*100).toFixed(1)}%)`);
console.log(`Sunday:   Top 5: ${baseRes.sun.ud5}/5 (${(baseRes.sun.ud5/5*100).toFixed(1)}%) | Top 10: ${baseRes.sun.ud10}/10 (${(baseRes.sun.ud10/10*100).toFixed(1)}%) | Top 20: ${baseRes.sun.ud20}/20 (${(baseRes.sun.ud20/20*100).toFixed(1)}%)`);
console.log(`Combined: Top 5: ${baseRes.comb.ud5}/5 (${(baseRes.comb.ud5/5*100).toFixed(1)}%) | Top 10: ${baseRes.comb.ud10}/10 (${(baseRes.comb.ud10/10*100).toFixed(1)}%) | Top 20: ${baseRes.comb.ud20}/20 (${(baseRes.comb.ud20/20*100).toFixed(1)}%)`);

// 2. CURRENT DEFAULT RULES
console.log('\n========================================================================');
console.log('2. CURRENT SYSTEM EVALUATION');
console.log('========================================================================');
const defaultWeights: Record<number, number> = {};
catalog.forEach(c => defaultWeights[c.id] = c.defaultPoints);
const curRes = evaluateWeights(defaultWeights, true);
console.log(`Saturday: Top 5: ${curRes.sat.ud5}/5 (${(curRes.sat.ud5/5*100).toFixed(1)}%) | Top 10: ${curRes.sat.ud10}/10 (${(curRes.sat.ud10/10*100).toFixed(1)}%) | Top 20: ${curRes.sat.ud20}/20 (${(curRes.sat.ud20/20*100).toFixed(1)}%)`);
console.log(`Sunday:   Top 5: ${curRes.sun.ud5}/5 (${(curRes.sun.ud5/5*100).toFixed(1)}%) | Top 10: ${curRes.sun.ud10}/10 (${(curRes.sun.ud10/10*100).toFixed(1)}%) | Top 20: ${curRes.sun.ud20}/20 (${(curRes.sun.ud20/20*100).toFixed(1)}%)`);
console.log(`Combined: Top 5: ${curRes.comb.ud5}/5 (${(curRes.comb.ud5/5*100).toFixed(1)}%) | Top 10: ${curRes.comb.ud10}/10 (${(curRes.comb.ud10/10*100).toFixed(1)}%) | Top 20: ${curRes.comb.ud20}/20 (${(curRes.comb.ud20/20*100).toFixed(1)}%)`);

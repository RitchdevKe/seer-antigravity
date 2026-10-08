import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const candidateWeightsData = JSON.parse(fs.readFileSync(`${outDir}\\optimized_candidate_weights.json`, 'utf8'));
const matches = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_matches_matrix.json`, 'utf8'));

const candidateWeights = candidateWeightsData.map((r: any) => r.newPoints);

// 5-Fold Stratified Cross-Validation
const mfavMatches = matches.filter((m: any) => m.outcome === 'MFAV');
const lossMatches = matches.filter((m: any) => m.outcome !== 'MFAV');

const K = 5;
const foldStats: any[] = [];

for (let k = 0; k < K; k++) {
  // Test set: k-th slice
  const testMfav = mfavMatches.filter((_: any, idx: number) => idx % K === k);
  const testLoss = lossMatches.filter((_: any, idx: number) => idx % K === k);
  const testSet = [...testMfav, ...testLoss];

  const scored = testSet.map((m: any) => {
    let score = m.basePoints;
    for (const rIdx of m.triggeredRuleIndices) {
      score += candidateWeights[rIdx] || 0;
    }
    return { outcome: m.outcome, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const top10 = scored.slice(0, 10);
  const mfav10 = top10.filter(s => s.outcome === 'MFAV').length;
  const top20 = scored.slice(0, 20);
  const mfav20 = top20.filter(s => s.outcome === 'MFAV').length;

  foldStats.push({
    fold: k + 1,
    testSize: testSet.length,
    testMfav: testMfav.length,
    testLoss: testLoss.length,
    top10_mfav: `${mfav10}/${Math.min(10, top10.length)} (${((mfav10 / Math.min(10, top10.length)) * 100).toFixed(0)}%)`,
    top20_mfav: `${mfav20}/${Math.min(20, top20.length)} (${((mfav20 / Math.min(20, top20.length)) * 100).toFixed(0)}%)`
  });
}

console.log('--- 5-FOLD STRATIFIED VALIDATION RESULTS ---');
console.table(foldStats);

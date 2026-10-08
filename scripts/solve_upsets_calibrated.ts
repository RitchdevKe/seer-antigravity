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

// Initial calibrated weights based on empirical win rates
const weights: Record<number, number> = {};
catalog.forEach(c => weights[c.id] = 0);

// Set empirical assignments:
// 1. TOP UNDERDOG DRIVERS (High positive points)
// Underdog was away on LE and Won (41.9% Ud)
weights[40] = 20;
// Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength (40.9% Ud)
weights[6] = 20;
// Underdog odds <= 2.80 (37.8% Ud, 111 matches)
weights[26] = 20;
// Both teams GA > GS and Both team GS <=1.0 (35.0% Ud)
weights[19] = 15;
// High Favorite Odds (>= 2.50) (33.3% Ud)
weights[23] = 15;
// LE Underdog won with 2+ goals (33.3% Ud)
weights[41] = 15;
// Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA (32.1% Ud)
weights[2] = 15;
// LE : Underdog won the last encounter (32.0% Ud, 100 matches)
weights[38] = 15;
// Underdog was Home on LE and still playing at Home (29.6% Ud)
weights[39] = 10;
// Underdog GA < Mfav GA with =>0.1 but <0.5 points (28.9% Ud)
weights[3] = 10;
// Underdog GA < Mfav GA with =>0.5 points (28.1% Ud)
weights[4] = 10;
// Sub pattern + Algo primary prediction supports underdog (29.0% Ud)
weights[44] = 10;
// Underdog has hidden strength/weakness (28.6% Ud)
weights[7] = 10;
// Und GS and GA =>2.0 (46.2% Ud)
weights[9] = 10;
// Underdog has hidden strength/weakness+Und GS and GA =>2.0 (44.4% Ud)
weights[10] = 10;
// Odds for underdog <= draw odds (29.4% Ud)
weights[20] = 5;
// Odds for underdog <= draw odds (2.80 to 3.00) (29.2% Ud)
weights[22] = 5;
// Point System Inversion (Underdog points > Favorite)
weights[36] = 10;
// Underdog has >= 5 more points on point system
weights[35] = 10;
// Underdog has >= 45 points on point system + Sub pattern primary prediction supports the underdog
weights[34] = 10;
// Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog
weights[43] = 5;

// 2. DEADLY TRAPS & FAVORITE DOMINANCE (Penalties)
// INVERT: Mfav GS =>1.8 and GA =<1.0 (11.1% Ud, 11 MFAV wins)
weights[15] = -25;
// Sub pattern primary on draw and hedges with underdog (16.7% Ud, 6 MFAV wins)
weights[46] = -15;
// INVERT: 1X2 Rating => 7 (17.9% Ud, 19 MFAV wins)
weights[27] = -20;
// Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2) (18.5% Ud, 30 MFAV wins)
weights[5] = -15;
// INVERT: Point system has >= 70 points on M.fav (18.8% Ud, 10 MFAV wins)
weights[33] = -20;
// INVERT: Mfav GS - Ud GS >= 1.0 (20.0% Ud, 14 MFAV wins)
weights[16] = -15;
// Mfav has hidden strength/weakness (21.6% Ud, 58 MFAV wins)
weights[8] = -15;
// INVERT: M.fav GA is > 0.6 points lower than Underdog GA (22.0% Ud, 26 MFAV wins)
weights[17] = -15;
// INVERT: Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0
weights[18] = -15;
// M.fav and Underdog TS difference <= 0.1 (22.1% Ud, 31 MFAV wins)
weights[29] = -10;
// Odds for underdog <= odds for draw but >= 3.0 (22.8% Ud, 61 MFAV wins)
weights[21] = -10;
// Underdog GS >Mfav GS with >=0.4 points (23.9% Ud, 68 MFAV wins)
weights[1] = 0; // Neutralized from +10
// Match has BB, T12, or BD opw < 10% (27.2% Ud, 53 MFAV wins)
weights[42] = 5; // Reduced from +20 to prevent false upsets inflation
// Youth League (U21,U23,U20,U19)
weights[48] = -20;
// Point system has >= 60 points on M.fav
weights[32] = -10;
// M.fav TS >= 2.0 and Underdog TS < 1.0 (23.5% Ud)
weights[30] = -15;

function testCurrentWeights(w: Record<number, number>, label: string) {
  const evalSubset = (subset: typeof matrix) => {
    const scored = subset.map(m => {
      let totalScore = m.basePoints;
      m.triggeredRuleIds.forEach(id => totalScore += (w[id] ?? 0));
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

    const bRank = scored.findIndex(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal')) + 1;
    const bScore = scored.find(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal'))?.totalScore;

    return { ud5, ud10, ud20, dr5, dr10, dr20, mf5, mf10, mf20, bRank, bScore, top10, scored };
  };

  const sat = evalSubset(satMatches);
  const sun = evalSubset(sunMatches);
  const comb = evalSubset(matrix);

  console.log(`\n=================== ${label} ===================`);
  console.log(`Saturday: Top 5: ${sat.ud5}/5 (${(sat.ud5/5*100).toFixed(1)}%) [Drw: ${sat.dr5}, MF: ${sat.mf5}] | Top 10: ${sat.ud10}/10 (${(sat.ud10/10*100).toFixed(1)}%) | Top 20: ${sat.ud20}/20 (${(sat.ud20/20*100).toFixed(1)}%) | Brighton: #${sat.bRank} (${sat.bScore} pts)`);
  console.log(`Sunday:   Top 5: ${sun.ud5}/5 (${(sun.ud5/5*100).toFixed(1)}%) [Drw: ${sun.dr5}, MF: ${sun.mf5}] | Top 10: ${sun.ud10}/10 (${(sun.ud10/10*100).toFixed(1)}%) | Top 20: ${sun.ud20}/20 (${(sun.ud20/20*100).toFixed(1)}%)`);
  console.log(`Combined: Top 5: ${comb.ud5}/5 (${(comb.ud5/5*100).toFixed(1)}%) [Drw: ${comb.dr5}, MF: ${comb.mf5}] | Top 10: ${comb.ud10}/10 (${(comb.ud10/10*100).toFixed(1)}%) | Top 20: ${comb.ud20}/20 (${(comb.ud20/20*100).toFixed(1)}%)`);

  console.log('\n--- SATURDAY TOP 10 ---');
  sat.top10.forEach((m, idx) => {
    const mark = m.outcome === 'UNDERDOG' ? '✅ UD' : (m.outcome === 'DRAW' ? '⚠️ DR' : '❌ MF');
    console.log(`${(idx + 1).toString().padStart(2)}. [${mark}] ${m.teams.padEnd(35)} | Res: ${m.result.padEnd(5)} | Score: ${m.totalScore}`);
  });

  console.log('\n--- SUNDAY TOP 10 ---');
  sun.top10.forEach((m, idx) => {
    const mark = m.outcome === 'UNDERDOG' ? '✅ UD' : (m.outcome === 'DRAW' ? '⚠️ DR' : '❌ MF');
    console.log(`${(idx + 1).toString().padStart(2)}. [${mark}] ${m.teams.padEnd(35)} | Res: ${m.result.padEnd(5)} | Score: ${m.totalScore}`);
  });

  return { sat, sun, comb };
}

testCurrentWeights(weights, "EMPIRICALLY CALIBRATED UPSETS CONFIG");

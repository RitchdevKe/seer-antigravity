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

// Apply strict specialist consensus recommendations
const weights: Record<number, number> = {};
catalog.forEach(c => weights[c.id] = 0);

// Attack & Defense Specialist (ebe37280-9edd-488d-a68c-588585bc40a5)
weights[0] = 5;    // Both teams GA >= 1.1 (volatile match)
weights[1] = 0;    // Underdog GS >Mfav GS with >=0.4 points (Neutralized from +10)
weights[2] = 15;   // Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA (+15)
weights[3] = 10;   // Underdog GA < Mfav GA with =>0.1 but <0.5 points (+10)
weights[4] = 10;   // Underdog GA < Mfav GA with =>0.5 points (+10)
weights[5] = -15;  // Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2) (-15)
weights[6] = 20;   // Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength (+20)
weights[7] = 10;   // Underdog has hidden strength/weakness (+10)
weights[8] = -15;  // Mfav has hidden strength/weakness (-15)
weights[9] = 10;   // Und GS and GA =>2.0 (+10)
weights[10] = 10;  // Underdog has hidden strength/weakness+Und GS and GA =>2.0 (+10)
weights[11] = 15;  // Both teams GS < 1.0 and Und GS > Mfav GS (+15)
weights[12] = -15; // Underdog GS < 1.0 but M.fav GS > 1.0 (-15)
weights[13] = -10; // Mfav GS and GA =>2.0 (-10)
weights[14] = -10; // Equal GS + AGA=HGS + M.fav has hidden weakness (-10)
weights[19] = 15;  // Both teams GA > GS and Both team GS <=1.0 (+15)

// Odds & Market Specialist (b60ca91a-f75f-4972-a25f-1988f87915a4)
weights[20] = 5;   // Odds for underdog <= draw odds (+5)
weights[21] = -10; // Odds for underdog <= odds for draw but >= 3.0 (-10)
weights[22] = 5;   // Odds for underdog <= draw odds (2.80 to 3.00) (+5)
weights[23] = 15;  // High Favorite Odds (>= 2.50) (+15)
weights[24] = -10; // Odds for draw is < 3.0 (-10)
weights[25] = 0;   // Odds for Mfav,draw and Underdog are all <3.0 (0)
weights[26] = 15;  // Underdog odds <= 2.80 (+15)
weights[27] = -20; // INVERT: 1X2 Rating => 7 (-20)

// Team Strength & Points Specialist (5af8d124-b486-40d2-a3c2-81af3f7cd58c)
weights[28] = 5;   // Mfav TS and underdog TS difference is <=0.4 (+5)
weights[29] = -10; // M.fav and Underdog TS difference <= 0.1 (-10)
weights[30] = -15; // M.fav TS >= 2.0 and Underdog TS < 1.0 (-15)
weights[31] = -5;  // INVERT: Mfav TS >= 2.0 and Ud TS < 0.7 (-5)
weights[32] = -10; // Point system has >= 60 points on M.fav (-10)
weights[33] = -15; // INVERT: Point system has >= 70 points on M.fav (-15)
weights[34] = 0;   // Ud >= 45 pts on point system + Sub primary on Ud (0)
weights[35] = 5;   // Underdog has >= 5 more points on point system (+5)
weights[36] = 5;   // Point System Inversion (Underdog points > Favorite) (+5)
weights[37] = 0;   // Underdog L10 greater than Mfav L10 (0)
weights[38] = 15;  // LE : Underdog won the last encounter (+15)
weights[39] = 5;   // Underdog was Home on LE and still playing at Home (+5)
weights[40] = 20;  // Underdog was away on LE and Won (+20)
weights[41] = 15;  // LE Underdog won with 2+ goals (+15)

// Consensus & Predictor Specialist (957faf07-2e1a-4d3f-8dc7-d6556f31b662)
weights[42] = 0;   // Match has BB, T12, or BD opw < 10% (0)
weights[43] = 0;   // Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog (0)
weights[44] = 5;   // Sub pattern + Algo primary prediction supports underdog (Consensus 10 pts) (+5)
weights[45] = 5;   // Seer primary predicts on underdog (+5)
weights[46] = -5;  // Sub pattern primary on draw and hedges with underdog (-5)
weights[47] = 0;   // PAA, SubPattern, Algo, and ML agree on 12 hedge (0)
weights[48] = -15; // Youth League (U21,U23,U20,U19) (-15)
weights[49] = -10; // Banned: Upset risk tag (-10)
weights[50] = 0;   // Match belong to israel leagues (0)
weights[51] = 0;   // Match belong to African leagues (0)

function runTest(w: Record<number, number>, label: string) {
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

runTest(weights, "STRICT SPECIALIST HARMONIZED WEIGHTS");

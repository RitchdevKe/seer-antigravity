const fs = require('fs');

// Load evaluated Sunday matches
const pool = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\sunday_value_picks_pool.json', 'utf8'));

console.log('Testing triggers across', pool.length, 'matches...');
const totalMfav = pool.filter(m => m.outcome === 'MFAV').length;
const totalDraw = pool.filter(m => m.outcome === 'DRAW').length;
const totalUd = pool.filter(m => m.outcome === 'UNDERDOG').length;
console.log(`Baseline: Total=${pool.length}, Mfav=${totalMfav} (${(totalMfav/pool.length*100).toFixed(1)}%), Draw=${totalDraw} (${(totalDraw/pool.length*100).toFixed(1)}%), Underdog=${totalUd} (${(totalUd/pool.length*100).toFixed(1)}%)`);

// Define all single triggers as testable condition functions
const triggers = [
  { id: 'home_fav', desc: 'Home favorite', test: m => m.isHomeFav },
  { id: 'away_fav', desc: 'Away favorite', test: m => m.isAwayFav },
  { id: 'high_conviction_defense_attack', desc: 'High Conviction Defense + Attack Dominance', test: m => m.highConvictionDefenseAttack },
  { id: 'fav_ts_ge_2_ud_ts_lt_07', desc: 'Mfav TS >= 2.0 and Underdog TS < 0.7', test: m => m.favTsGe2UdTsLt07 },
  { id: 'fav_ts_ge_3_ud_ts_lt_08', desc: 'Mfav TS >= 3.0 and Ud TS < 0.8', test: m => m.favTS >= 3.0 && m.udTS < 0.8 },
  { id: 'fav_ts_15_20_ud_ts_lt_05', desc: 'Mfav TS 1.5-1.99 and Ud TS < 0.5', test: m => m.favTS >= 1.5 && m.favTS < 2.0 && m.udTS < 0.5 },
  { id: 'fav_ts_10_15_ud_ts_lt_08', desc: 'Mfav TS 1.0-1.50 and Ud TS < 0.8', test: m => m.favTS >= 1.0 && m.favTS <= 1.5 && m.udTS < 0.8 },
  { id: 'ts_diff_le_0_1', desc: 'TS difference <= 0.1', test: m => m.tsDiff <= 0.1 + Number.EPSILON },
  { id: 'ts_diff_ge_1_0', desc: 'TS difference >= 1.0', test: m => m.tsDiff >= 1.0 },
  { id: 'algo_mfav_gt_50', desc: 'Algo support for Mfav > 50%', test: m => m.algoProbFav > 50 },
  { id: 'algo_mfav_45_50', desc: 'Algo support for Mfav is 45-50%', test: m => m.algoProbFav >= 45 && m.algoProbFav <= 50 },
  { id: 'algo_mfav_lt_40', desc: 'Algo for Mfav support < 40%', test: m => m.algoProbFav > 0 && m.algoProbFav < 40 },
  { id: 'algo_ud_gt_35', desc: 'Algo support for Underdog > 35%', test: m => m.algoProbUd > 35 },
  { id: 'seer_draw_le_20', desc: 'Seer score on draw <= 20%', test: m => m.seerScoreDraw > 0 && m.seerScoreDraw <= 20 },
  { id: 'seer_draw_ge_35', desc: 'Seer score on draw >= 35%', test: m => m.seerScoreDraw >= 35 },
  { id: 'seer_ud_ge_45', desc: 'Seer score on underdog >= 45%', test: m => m.seerScoreUd >= 45 },
  { id: 'seer_prim_on_ud', desc: 'Seer primary predicts on underdog', test: m => m.seerPrimPred === (m.mFav === '1' ? '2' : '1') },
  { id: 'seer_prim_on_fav', desc: 'Seer primary predicts on favorite', test: m => m.seerPrimPred === m.mFav },
  { id: 'ud_odds_lt_2_8', desc: 'Odds for underdog < 2.8', test: m => m.udOdds > 0 && m.udOdds < 2.8 },
  { id: 'ud_odds_ge_3_0', desc: 'Odds for underdog >= 3.0', test: m => m.udOdds >= 3.0 },
  { id: 'draw_odds_lt_3_0', desc: 'Odds for draw < 3.0', test: m => m.drawOdds > 0 && m.drawOdds < 3.0 },
  { id: 'draw_odds_lt_3_2', desc: 'Draw odds < 3.2', test: m => m.drawOdds > 0 && m.drawOdds < 3.2 },
  { id: 'draw_odds_gt_3_5', desc: 'Draw odds > 3.5', test: m => m.drawOdds > 3.5 },
  { id: 'razor_parity', desc: 'Razor parity (oddsDiff < 0.20)', test: m => m.isRazorParity },
  { id: 'odds_diff_ge_1_0', desc: 'Odds difference >= 1.0', test: m => m.oddsDiff >= 1.0 },
  { id: 'mfav_gs_ud_gs_close', desc: 'Mfav GS close to Ud GS (+-0.2)', test: m => m.isMfavGsUndGsClose },
  { id: 'mfav_ga_ud_ga_close', desc: 'Mfav GA close to Ud GA (+-0.2)', test: m => m.isMfavGaUndGaClose },
  { id: 'ud_ga_lt_mfav_ga', desc: 'Ud GA < Mfav GA (defensive edge)', test: m => m.isUdGaLtMfavGa },
  { id: 'mfav_ga_le_1_ud_ga_gt_1', desc: 'Mfav GA <= 1.0 but Underdog GA > 1.0', test: m => m.mFavGA <= 1.0 && m.udGA > 1.0 },
  { id: 'both_ga_ge_1_1_volatile', desc: 'Both teams GA >= 1.1 (volatile match)', test: m => m.isVolatile },
  { id: 'both_ga_gt_gs', desc: 'Both teams GA > GS', test: m => m.bothTeamsGAGtGS },
  { id: 'both_gs_ge_2_ga_ge_1', desc: 'Team A and Team B GS >= 2.0 and GA >= 1.0', test: m => m.bothGSGe2GAGe1 },
  { id: 'ud_points_gt_fav_by_5', desc: 'Underdog has >= 5 more points on point system', test: m => m.pointDiff >= 5 },
  { id: 'fav_points_ge_60', desc: 'Point system has >= 60 points on Mfav', test: m => (m.totalPoints?.home >= 60 && m.mFav === '1') || (m.totalPoints?.away >= 60 && m.mFav === '2') },
  { id: 'pha_fav_win_ge_50', desc: 'PHA Fav Win >= 50%', test: m => m.phaFavWin >= 50 },
  { id: 'pha_fav_win_ge_60', desc: 'PHA Fav Win >= 60%', test: m => m.phaFavWin >= 60 },
  { id: 'fav_odds_20_25', desc: 'Favorite Odds in Value range (2.0-2.5)', test: m => m.favOdds >= 2.0 && m.favOdds <= 2.5 }
];

// Evaluate each single trigger
const singleResults = triggers.map(trig => {
  let count = 0, mfav = 0, draw = 0, ud = 0;
  pool.forEach(m => {
    if (trig.test(m)) {
      count++;
      if (m.outcome === 'MFAV') mfav++;
      else if (m.outcome === 'DRAW') draw++;
      else ud++;
    }
  });
  const mfavPct = count > 0 ? (mfav / count * 100) : 0;
  const drawPct = count > 0 ? (draw / count * 100) : 0;
  const udPct = count > 0 ? (ud / count * 100) : 0;
  return {
    id: trig.id,
    desc: trig.desc,
    count,
    mfav,
    draw,
    ud,
    mfavPct: parseFloat(mfavPct.toFixed(1)),
    drawPct: parseFloat(drawPct.toFixed(1)),
    udPct: parseFloat(udPct.toFixed(1)),
    delta: parseFloat((mfavPct - (totalMfav / pool.length * 100)).toFixed(1))
  };
});

singleResults.sort((a, b) => b.mfavPct - a.mfavPct);

console.log('\n=== TOP 15 POSITIVE SINGLE TRIGGERS (Best for Mfav) ===');
singleResults.slice(0, 15).forEach(r => {
  console.log(`[${r.count} matches] Mfav: ${r.mfavPct}% (${r.mfav}/${r.count}) | Draw: ${r.drawPct}% | Ud: ${r.udPct}% | ${r.desc}`);
});

console.log('\n=== TOP 10 NEGATIVE SINGLE TRIGGERS (Dangerous Traps / Penalties) ===');
const negativeResults = [...singleResults].sort((a, b) => a.mfavPct - b.mfavPct);
negativeResults.slice(0, 10).forEach(r => {
  console.log(`[${r.count} matches] Mfav: ${r.mfavPct}% (${r.mfav}/${r.count}) | Draw: ${r.drawPct}% | Ud: ${r.udPct}% | ${r.desc}`);
});

// Test Pairwise Combinations
console.log('\n=== TESTING PAIRWISE SYNERGIES (Trigger A + Trigger B) ===');
const pairwiseResults = [];
for (let i = 0; i < triggers.length; i++) {
  for (let j = i + 1; j < triggers.length; j++) {
    const tA = triggers[i];
    const tB = triggers[j];
    
    let count = 0, mfav = 0, draw = 0, ud = 0;
    pool.forEach(m => {
      if (tA.test(m) && tB.test(m)) {
        count++;
        if (m.outcome === 'MFAV') mfav++;
        else if (m.outcome === 'DRAW') draw++;
        else ud++;
      }
    });

    if (count >= 5) {
      const mfavPct = parseFloat((mfav / count * 100).toFixed(1));
      const drawPct = parseFloat((draw / count * 100).toFixed(1));
      const udPct = parseFloat((ud / count * 100).toFixed(1));
      const sA = singleResults.find(r => r.id === tA.id).mfavPct;
      const sB = singleResults.find(r => r.id === tB.id).mfavPct;
      const maxSingle = Math.max(sA, sB);
      const synergyBoost = parseFloat((mfavPct - maxSingle).toFixed(1));

      pairwiseResults.push({
        idA: tA.id,
        descA: tA.desc,
        idB: tB.id,
        descB: tB.desc,
        count,
        mfav,
        draw,
        ud,
        mfavPct,
        drawPct,
        udPct,
        maxSingle,
        synergyBoost
      });
    }
  }
}

pairwiseResults.sort((a, b) => b.mfavPct - a.mfavPct);

console.log(`Found ${pairwiseResults.length} combos with count >= 5.`);
console.log('\nTop 20 Highest Accuracy Combinations:');
pairwiseResults.slice(0, 20).forEach(c => {
  console.log(`[${c.count} matches] Mfav: ${c.mfavPct}% (${c.mfav}/${c.count}) | Draw: ${c.drawPct}% | Ud: ${c.udPct}% | Boost: +${c.synergyBoost}% | ${c.descA} + ${c.descB}`);
});

fs.writeFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\value_picks_single_triggers.json', JSON.stringify(singleResults, null, 2));
fs.writeFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\value_picks_synergies.json', JSON.stringify(pairwiseResults, null, 2));
console.log('\nSaved single triggers and pairwise synergies to scratch.');

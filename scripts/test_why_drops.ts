import { Pool } from 'pg';
import { Match } from '../src/types';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';
import { getOptimizedScoreDetailed } from '../src/utils/optimizedweights';
import { isBannedFromSeerSlips } from '../src/utils/leagueFilters';

const rdsConfig = {
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

function getOdds(m: Match) {
  const mo = m.mo || '';
  const parts = mo.split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
  const o1 = parts[0] || 0;
  const ox = parts[1] || 0;
  const o2 = parts[2] || 0;
  const validOdds = [o1, o2].filter(o => o > 1.0);
  const favOdds = validOdds.length > 0 ? Math.min(...validOdds) : 0;
  return { o1, ox, o2, favOdds };
}

async function main() {
  const pool = new Pool(rdsConfig);
  try {
    const res = await pool.query('SELECT data FROM live_matches');
    const matches: Match[] = res.rows.map(r => r.data).filter(Boolean);

    const phaStatsMap = {};
    const matchStars = {};

    console.log(`=== ANALYZING 73 LIVE MATCHES FOR SEER SLIPS ===`);

    // Let's test BEST BET
    // filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 1.3 && o.favOdds <= 1.6; }
    // tag: best_bet:
    console.log('\n--- BEST BET ---');
    let bbTagged = 0;
    let bbOddsPassed = 0;
    let bbScorePositive = 0;
    matches.forEach(m => {
      const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
      const hasTag = tags.some(t => t.startsWith('best_bet:'));
      if (hasTag) {
        bbTagged++;
        const o = getOdds(m);
        const oddsPass = o.favOdds >= 1.3 && o.favOdds <= 1.6;
        const score = getOptimizedScoreDetailed(m, 'best_bet', phaStatsMap).totalScore;
        if (oddsPass) bbOddsPassed++;
        if (oddsPass && score > 0) bbScorePositive++;
        console.log(`[BB] ID:${m.id} | FavOdds:${o.favOdds} (Pass:${oddsPass}) | Score:${score} | Teams:${m.teams}`);
      }
    });
    console.log(`Best Bet Summary: Tagged=${bbTagged}, OddsPass=${bbOddsPassed}, ScorePositive=${bbScorePositive}`);

    // Let's test TOP 12
    // filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 2.0 && o.favOdds <= 3.0; }
    // tag: top12: or top10:
    console.log('\n--- TOP 12 ---');
    let t12Tagged = 0;
    let t12OddsPassed = 0;
    let t12ScorePositive = 0;
    matches.forEach(m => {
      const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
      const hasTag = tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'));
      if (hasTag) {
        t12Tagged++;
        const o = getOdds(m);
        const oddsPass = o.favOdds >= 2.0 && o.favOdds <= 3.0;
        const score = getOptimizedScoreDetailed(m, 'top_12_value', phaStatsMap).totalScore;
        if (oddsPass) t12OddsPassed++;
        if (oddsPass && score > 0) t12ScorePositive++;
        console.log(`[T12] ID:${m.id} | FavOdds:${o.favOdds} (Pass:${oddsPass}) | Score:${score} | Teams:${m.teams}`);
      }
    });
    console.log(`Top 12 Summary: Tagged=${t12Tagged}, OddsPass=${t12OddsPassed}, ScorePositive=${t12ScorePositive}`);

    // Let's test UPSETS
    // tag: upsets:
    console.log('\n--- UPSETS ---');
    let upsTagged = 0;
    let upsScorePositive = 0;
    matches.forEach(m => {
      const tags = getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
      const hasTag = tags.some(t => t.startsWith('upsets:'));
      if (hasTag) {
        upsTagged++;
        const score = getOptimizedScoreDetailed(m, 'upsets', phaStatsMap).totalScore;
        if (score > 0) upsScorePositive++;
        console.log(`[UPS] ID:${m.id} | Score:${score} | Teams:${m.teams}`);
      }
    });
    console.log(`Upsets Summary: Tagged=${upsTagged}, ScorePositive=${upsScorePositive}`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);

import { Pool } from 'pg';
import { getOptimizedScoreDetailed } from '../src/utils/optimizedweights';
import { getMarketFavorite } from '../src/utils/opwCommon';

const pool = new Pool({
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

function getActualResult(resultStr: string): string {
  if (!resultStr || resultStr === 'Unknown') return 'Unknown';
  const parts = resultStr.split(':').map(s => parseInt(s.trim(), 10));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 'Unknown';
  if (parts[0] > parts[1]) return '1';
  if (parts[0] < parts[1]) return '2';
  return 'X';
}

async function main() {
  const res = await pool.query('SELECT data FROM live_matches');
  const matches = res.rows.map((r: any) => r.data).filter(Boolean);
  const t12 = matches.filter((m: any) => (m.evaluatorTags || []).some((t: string) => t.startsWith('top12:') || t.startsWith('top10:')));
  
  const scored = t12.map((m: any) => {
    const actual = getActualResult(m.result || '');
    const mfav = getMarketFavorite(m);
    let outcome: 'mfav' | 'draw' | 'underdog';
    if (actual === mfav) outcome = 'mfav';
    else if (actual === 'X') outcome = 'draw';
    else outcome = 'underdog';
    const isTarget = outcome === 'mfav' || outcome === 'draw';
    const detail = getOptimizedScoreDetailed(m, 'top_12_value', {}, 'thursday');
    return {
      match: m,
      outcome,
      isTarget,
      score: detail.totalScore,
      rulesHitCount: detail.rulesHit.length
    };
  }).sort((a, b) => b.score - a.score);

  console.log('=== REAL APPLICATION getOptimizedScoreDetailed (Thursday Top 12) ===');
  scored.forEach((s, idx) => {
    console.log(`Rank ${idx + 1}: Score: ${s.score} | Target: ${s.isTarget} | Res: ${s.match.result} | RulesHit: ${s.rulesHitCount} | ${s.match.teams}`);
    if (idx >= 0 && idx <= 8) {
      const detail = getOptimizedScoreDetailed(s.match, 'top_12_value', {}, 'thursday');
      console.log(`  [Base: ${detail.baseWeightInfo?.points}] Rules:`, detail.rulesHit.map(r => `${r.points >= 0 ? '+' : ''}${r.points} ${r.description}`));
    }
  });

  const firstTrapIndex = scored.findIndex(s => !s.isTarget);
  console.log(`\nFirst Trap Rank: ${firstTrapIndex + 1} (Expected: 7)`);

  await pool.end();
}

main().catch(e => {
  console.error(e);
  pool.end();
});

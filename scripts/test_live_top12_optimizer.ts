import { Pool } from 'pg';
import { 
  extractMatchEvaluationStats, 
  evaluateAllCatalogTriggers,
  getMarketFavorite
} from '../src/utils/opwCommon';
import { getOptimizedBaseWeight } from '../src/utils/optimizedweights';
import { getMasterTriggerDefaultPoints } from '../src/utils/opwCatalog';
import { getTriggerAccuracyProfile, getFullActiveCatalogTriggers } from '../src/opwalgo';

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
  
  const categoryId = 'top_12_value';
  const objective = 'mfav_draw';

  interface MatchProfile {
    index: number;
    match: any;
    outcome: 'mfav' | 'draw' | 'underdog';
    isTarget: boolean;
    baseScore: number;
    triggers: Set<string>;
  }

  const profiles: MatchProfile[] = [];
  const hitStatsMap = new Map<string, { mfav: number; draw: number; underdog: number }>();
  getFullActiveCatalogTriggers().forEach(t => hitStatsMap.set(t, { mfav: 0, draw: 0, underdog: 0 }));

  t12.forEach((m: any, idx: number) => {
    const actual = getActualResult(m.result || '');
    const mfav = getMarketFavorite(m);
    let outcome: 'mfav' | 'draw' | 'underdog';
    if (actual === mfav) outcome = 'mfav';
    else if (actual === 'X') outcome = 'draw';
    else outcome = 'underdog';

    const isTarget = outcome === 'mfav' || outcome === 'draw';
    const baseInfo = getOptimizedBaseWeight(m, {}, categoryId, 'thursday');
    const baseScore = baseInfo?.points ?? 0;

    const stats = extractMatchEvaluationStats(m, {}, categoryId);
    const allTriggers = evaluateAllCatalogTriggers(stats, m);
    const triggers = new Set<string>();

    allTriggers.forEach(t => {
      if (t === "Odds for underdog >= 3.0") return;
      triggers.add(t);
      let s = hitStatsMap.get(t);
      if (!s) {
        s = { mfav: 0, draw: 0, underdog: 0 };
        hitStatsMap.set(t, s);
      }
      if (outcome === 'mfav') s.mfav++;
      else if (outcome === 'draw') s.draw++;
      else s.underdog++;
    });

    profiles.push({
      index: idx,
      match: m,
      outcome,
      isTarget,
      baseScore,
      triggers
    });
  });

  const targets = profiles.filter(p => p.isTarget);
  const traps = profiles.filter(p => !p.isTarget);
  console.log(`Total Matches: ${profiles.length} | Targets: ${targets.length} | Traps: ${traps.length}`);

  // Test current points evaluation
  // Look at which triggers only appear in targets vs only appear in traps
  const targetExclusiveTriggers = new Map<string, number>();
  const trapExclusiveTriggers = new Map<string, number>();
  const sharedTriggers = new Map<string, { targets: number; traps: number }>();

  hitStatsMap.forEach((counts, t) => {
    const total = counts.mfav + counts.draw + counts.underdog;
    if (total === 0) return;
    const tHits = counts.mfav + counts.draw;
    const trHits = counts.underdog;
    if (tHits > 0 && trHits === 0) targetExclusiveTriggers.set(t, tHits);
    else if (trHits > 0 && tHits === 0) trapExclusiveTriggers.set(t, trHits);
    else sharedTriggers.set(t, { targets: tHits, traps: trHits });
  });

  console.log(`\nTarget-exclusive triggers (${targetExclusiveTriggers.size}):`);
  targetExclusiveTriggers.forEach((hits, t) => console.log(`  [+Target] "${t}" (${hits} hits)`));

  console.log(`\nTrap-exclusive triggers (${trapExclusiveTriggers.size}):`);
  trapExclusiveTriggers.forEach((hits, t) => console.log(`  [-Trap] "${t}" (${hits} hits)`));

  console.log(`\nShared triggers (${sharedTriggers.size}):`);
  sharedTriggers.forEach((info, t) => console.log(`  [Shared] "${t}": ${info.targets} Targets, ${info.traps} Traps`));

  // Now let's test if giving bonuses to target-exclusive triggers and penalties to trap-exclusive triggers separates all 6 matches!
  const testPoints = new Map<string, number>();
  getFullActiveCatalogTriggers().forEach(t => testPoints.set(t, 0));

  targetExclusiveTriggers.forEach((_, t) => testPoints.set(t, 20));
  trapExclusiveTriggers.forEach((_, t) => testPoints.set(t, -25));

  console.log("\nEvaluating separation with target-exclusive=+20 and trap-exclusive=-25:");
  const scoredProfiles = profiles.map(p => {
    let score = p.baseScore;
    p.triggers.forEach(t => {
      score += testPoints.get(t) ?? 0;
    });
    return { ...p, score };
  }).sort((a, b) => b.score - a.score);

  scoredProfiles.forEach((p, rank) => {
    console.log(`Rank ${rank + 1}: Score ${p.score} | Target: ${p.isTarget} | Res: ${p.match.result} | ${p.match.teams}`);
  });

  const firstTrapIndex = scoredProfiles.findIndex(p => !p.isTarget);
  console.log(`\nFirst Trap Rank: ${firstTrapIndex + 1} (Expected: 7)`);

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });

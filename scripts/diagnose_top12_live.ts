import { Pool } from 'pg';
import { 
  extractMatchEvaluationStats, 
  evaluateAllCatalogTriggers,
  getMarketFavorite,
  getMatchDayOfWeek
} from '../src/utils/opwCommon';
import { getOptimizedBaseWeight, DAILY_DEFAULT_CATEGORY_SETTINGS } from '../src/utils/optimizedweights';
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
  
  console.log(`Analyzing ${t12.length} Top 12 matches...`);

  const categoryId = 'top_12_value';
  const objective = 'mfav_draw';

  interface MatchData {
    match: any;
    outcome: 'mfav' | 'draw' | 'underdog';
    isTarget: boolean;
    baseScore: number;
    triggers: Set<string>;
  }

  const profiles: MatchData[] = [];
  const hitStats = new Map<string, { mfav: number; draw: number; underdog: number }>();
  getFullActiveCatalogTriggers().forEach(t => hitStats.set(t, { mfav: 0, draw: 0, underdog: 0 }));

  t12.forEach((m: any, idx: number) => {
    const actual = getActualResult(m.result || '');
    const mfav = getMarketFavorite(m);
    let outcome: 'mfav' | 'draw' | 'underdog';
    if (actual === mfav) outcome = 'mfav';
    else if (actual === 'X') outcome = 'draw';
    else outcome = 'underdog';

    const isTarget = outcome === 'mfav' || outcome === 'draw';
    const matchDay = 'thursday';
    const baseInfo = getOptimizedBaseWeight(m, {}, categoryId, matchDay);
    const baseScore = baseInfo?.points ?? 0;

    const stats = extractMatchEvaluationStats(m, {}, categoryId);
    const allTriggers = evaluateAllCatalogTriggers(stats, m);
    const triggers = new Set<string>();

    allTriggers.forEach(t => {
      if (t === "Odds for underdog >= 3.0") return;
      triggers.add(t);
      let s = hitStats.get(t);
      if (!s) {
        s = { mfav: 0, draw: 0, underdog: 0 };
        hitStats.set(t, s);
      }
      if (outcome === 'mfav') s.mfav++;
      else if (outcome === 'draw') s.draw++;
      else s.underdog++;
    });

    profiles.push({
      match: m,
      outcome,
      isTarget,
      baseScore,
      triggers
    });

    console.log(`\nMatch ${idx + 1}: ${m.teams} | Res: ${m.result} (${actual}) | Outcome: ${outcome} (Target: ${isTarget}) | BaseScore: ${baseScore}`);
    console.log(`Triggers hit (${triggers.size}):`, Array.from(triggers));
  });

  console.log("\n=================== HIT STATS SUMMARY ===================");
  const activeTriggers = Array.from(hitStats.entries())
    .filter(([_, counts]) => (counts.mfav + counts.draw + counts.underdog) > 0)
    .sort((a, b) => (b[1].mfav + b[1].draw + b[1].underdog) - (a[1].mfav + a[1].draw + a[1].underdog));

  activeTriggers.forEach(([t, counts]) => {
    const total = counts.mfav + counts.draw + counts.underdog;
    const profile = getTriggerAccuracyProfile(t, counts, objective);
    console.log(`Trigger: "${t}" | Hits: ${total} (Mfav: ${counts.mfav}, Draw: ${counts.draw}, UD: ${counts.underdog})`);
    console.log(`  Historical Anchor: ${profile.historicalAnchor} | AllowedBand: [${profile.allowedBand.join(', ')}]`);
  });

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });

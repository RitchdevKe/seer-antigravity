import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed, getOptimizedBaseWeight, CODE_DEFAULT_CATEGORY_SETTINGS } from '../src/utils/optimizedweights';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json';
const matches: Array<{
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
  match: Match;
}> = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};

function evaluateBatch(label: string) {
  const batch = matches.filter(m => m.batch.includes(label));
  const scored = batch.map(m => {
    const detail = getOptimizedScoreDetailed(m.match, 'upsets', phaStatsMap);
    return {
      ...m,
      totalScore: detail.totalScore,
      rulesHit: detail.rulesHit
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  console.log(`\n================== CURRENT ${label.toUpperCase()} TOP 20 ==================`);
  const top20 = scored.slice(0, 20);
  let udWins = 0;
  let draws = 0;
  let mfavWins = 0;

  top20.forEach((m, idx) => {
    if (m.outcome === 'UNDERDOG') udWins++;
    else if (m.outcome === 'DRAW') draws++;
    else mfavWins++;

    const mark = m.outcome === 'UNDERDOG' ? '✅ UNDERDOG' : (m.outcome === 'DRAW' ? '❌ DRAW' : '❌ MFAV');
    console.log(`${(idx + 1).toString().padStart(2)}. [${mark}] ${m.teams} | Res: ${m.result} | Score: ${m.totalScore} (Base: ${m.basePoints})`);
    if (idx < 5) {
      console.log(`    Top rules:`, m.rulesHit.slice(0, 5).map(r => `${r.description} (${r.points})`).join('; '));
    }
  });

  console.log(`\nTop 5:  ${scored.slice(0, 5).filter(m => m.outcome === 'UNDERDOG').length}/5 (${(scored.slice(0, 5).filter(m => m.outcome === 'UNDERDOG').length/5*100).toFixed(1)}%)`);
  console.log(`Top 10: ${scored.slice(0, 10).filter(m => m.outcome === 'UNDERDOG').length}/10 (${(scored.slice(0, 10).filter(m => m.outcome === 'UNDERDOG').length/10*100).toFixed(1)}%)`);
  console.log(`Top 20: ${udWins}/20 (${(udWins/20*100).toFixed(1)}%) [Draws: ${draws}, MFav: ${mfavWins}]`);
}

evaluateBatch('Saturday');
evaluateBatch('Sunday');
